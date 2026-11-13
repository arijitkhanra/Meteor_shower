import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Application State
const state = {
    currentView: '3d',
    dataLoaded: false,
    stats: null,
    showers: [],
    meteors3D: [],
    animationRunning: true,
    speedMultiplier: 1.0,
    densityLimit: 500,
    showStars: true,
    showTrails: true,
    showEarth: true,
    page: 1,
    perPage: 25,
    searchQuery: '',
    showerFilter: '',
    totalRecords: 0
};

// 3D Scene Variables
let scene, camera, renderer, controls;
let meteorGroup, trailGroup, starField, earthMesh, atmosphereMesh;
let raycaster, mouse;
let clock = new THREE.Clock();
let fpsFrames = 0, fpsTime = 0;

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initThreeScene();
    setupEventListeners();
    await loadInitialData();
    hideLoadingScreen();
    animate();
});

// Loading Screen
function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => {
            loader.style.display = 'none';
            if (app) app.style.display = 'block';
            onWindowResize();
        }, 600);
    }
}

// Navigation Handler
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.getAttribute('data-view');
            switchView(targetView);
        });
    });
}

function switchView(viewName) {
    state.currentView = viewName;
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-view') === viewName);
    });

    document.querySelectorAll('.view').forEach(v => {
        v.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${viewName}`);
    if (activeView) activeView.classList.add('active');

    if (viewName === '3d') {
        onWindowResize();
    } else if (viewName === 'dashboard') {
        renderDashboard();
    } else if (viewName === 'data') {
        fetchMeteorTableData();
    }
}

// Three.js 3D Universe Setup
function initThreeScene() {
    const container = document.getElementById('scene-container');
    if (!container) return;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070913, 0.035);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 5, 9);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 30;
    controls.minDistance = 2;

    // Ambient and directional lighting
    const ambientLight = new THREE.AmbientLight(0x404870, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(15, 20, 15);
    scene.add(dirLight);

    // Groups
    meteorGroup = new THREE.Group();
    trailGroup = new THREE.Group();
    scene.add(meteorGroup);
    scene.add(trailGroup);

    // Create Cosmic Elements
    createStarfield();
    createEarth();

    // Raycasting for interactive hover
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
}

function createStarfield() {
    const starCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 80;
        positions[i + 1] = (Math.random() - 0.5) * 80;
        positions[i + 2] = (Math.random() - 0.5) * 80;

        const tint = Math.random();
        colors[i] = tint > 0.7 ? 0.6 : 0.9;
        colors[i + 1] = tint > 0.5 ? 0.8 : 0.95;
        colors[i + 2] = 1.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.85
    });

    starField = new THREE.Points(geometry, material);
    scene.add(starField);
}

function createEarth() {
    const earthGeo = new THREE.SphereGeometry(1.2, 48, 48);
    const earthMat = new THREE.MeshPhongMaterial({
        color: 0x1a365d,
        emissive: 0x071b30,
        specular: 0x334466,
        shininess: 25,
        wireframe: false
    });
    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // Atmospheric Glow Sphere
    const atmosGeo = new THREE.SphereGeometry(1.28, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.18,
        wireframe: true
    });
    atmosphereMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosphereMesh);
}

function onWindowResize() {
    const container = document.getElementById('scene-container');
    if (!container || !renderer || !camera) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meteorGroup.children);

    const tooltip = document.getElementById('meteor-tooltip');
    if (intersects.length > 0) {
        const item = intersects[0].object.userData;
        if (item && tooltip) {
            document.getElementById('tip-id').textContent = item.id || 'Unknown';
            document.getElementById('tip-shower').textContent = item.shower || 'Sporadic';
            document.getElementById('tip-peak').textContent = item.peak != null ? item.peak.toFixed(1) : '-';
            document.getElementById('tip-dur').textContent = item.duration != null ? item.duration.toFixed(2) + 's' : '-';
            document.getElementById('tip-vel').textContent = item.vgeo != null ? item.vgeo.toFixed(1) + ' km/s' : '-';
            tooltip.classList.remove('hidden');
        }
    } else if (tooltip) {
        tooltip.classList.add('hidden');
    }
}

// Load Meteors into 3D Space
async function load3DData() {
    try {
        const res = await fetch(`/api/3d-data?limit=${state.densityLimit}`);
        if (!res.ok) throw new Error('Failed to load 3d data');
        const data = await res.json();
        state.meteors3D = data.meteors || [];

        // Clear existing
        while (meteorGroup.children.length > 0) {
            meteorGroup.remove(meteorGroup.children[0]);
        }
        while (trailGroup.children.length > 0) {
            trailGroup.remove(trailGroup.children[0]);
        }

        let totalVel = 0;
        state.meteors3D.forEach((m, idx) => {
            totalVel += (m.vgeo || 30);
            const size = Math.max(0.04, Math.min(0.16, m.size || 0.08));
            const meteorGeo = new THREE.SphereGeometry(size, 16, 16);
            const color = new THREE.Color(m.color?.r ?? 1, m.color?.g ?? 0.6, m.color?.b ?? 0.2);
            const meteorMat = new THREE.MeshBasicMaterial({ color: color });
            const sphere = new THREE.Mesh(meteorGeo, meteorMat);

            const initialPos = new THREE.Vector3(
                m.position.x || (Math.random() - 0.5) * 8,
                m.position.y || (Math.random() - 0.5) * 8,
                m.position.z || (Math.random() - 0.5) * 8
            );
            sphere.position.copy(initialPos);

            // Orbit trajectory / velocity
            const vel = new THREE.Vector3(
                m.velocity?.x || -initialPos.x * 0.05,
                m.velocity?.y || -initialPos.y * 0.05,
                m.velocity?.z || -initialPos.z * 0.05
            );

            sphere.userData = {
                ...m,
                initialPos: initialPos.clone(),
                velocity: vel,
                orbitRadius: initialPos.length(),
                angle: Math.atan2(initialPos.z, initialPos.x),
                speed: (m.vgeo || 30) * 0.0003
            };

            meteorGroup.add(sphere);

            // Trail Line
            if (state.showTrails) {
                const trailGeo = new THREE.BufferGeometry();
                const trailPoints = [
                    initialPos.clone(),
                    initialPos.clone().add(vel.clone().multiplyScalar(15))
                ];
                trailGeo.setFromPoints(trailPoints);
                const trailMat = new THREE.LineBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.35
                });
                const line = new THREE.Line(trailGeo, trailMat);
                trailGroup.add(line);
            }
        });

        // HUD stats
        const activeCount = document.getElementById('active-count');
        const avgVel = document.getElementById('avg-vel');
        if (activeCount) activeCount.textContent = state.meteors3D.length;
        if (avgVel && state.meteors3D.length > 0) {
            avgVel.textContent = (totalVel / state.meteors3D.length).toFixed(1) + ' km/s';
        }
    } catch (e) {
        console.error('Error fetching 3D data:', e);
    }
}

// Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    fpsFrames++;
    fpsTime += delta;
    if (fpsTime >= 1.0) {
        const fpsElem = document.getElementById('fps');
        if (fpsElem) fpsElem.textContent = `${Math.round(fpsFrames / fpsTime)} FPS`;
        fpsFrames = 0;
        fpsTime = 0;
    }

    if (state.animationRunning) {
        const effectiveSpeed = state.speedMultiplier;

        // Earth rotation
        if (earthMesh) earthMesh.rotation.y += 0.003 * effectiveSpeed;
        if (atmosphereMesh) atmosphereMesh.rotation.y += 0.002 * effectiveSpeed;
        if (starField) starField.rotation.y += 0.0002 * effectiveSpeed;

        // Meteor movements
        meteorGroup.children.forEach(meteor => {
            const u = meteor.userData;
            u.angle += u.speed * effectiveSpeed;
            meteor.position.x = u.orbitRadius * Math.cos(u.angle);
            meteor.position.z = u.orbitRadius * Math.sin(u.angle);
            meteor.position.y += Math.sin(u.angle * 2) * 0.005 * effectiveSpeed;
        });
    }

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// Initial Data Fetching
async function loadInitialData() {
    try {
        const [statsRes, showersRes] = await Promise.all([
            fetch('/api/statistics').then(r => r.json()).catch(() => null),
            fetch('/api/showers').then(r => r.json()).catch(() => [])
        ]);

        state.stats = statsRes;
        state.showers = showersRes;

        populateShowerFilterDropdown(showersRes);
        await load3DData();
    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

// Populate Showers Dropdown
function populateShowerFilterDropdown(showers) {
    const select = document.getElementById('shower-filter');
    if (!select) return;
    select.innerHTML = '<option value="">All Showers</option>';
    showers.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = `${s.name} (${s.count})`;
        select.appendChild(opt);
    });
}

// Dashboard View Rendering
async function renderDashboard() {
    if (!state.stats) {
        try {
            state.stats = await fetch('/api/statistics').then(r => r.json());
            state.showers = await fetch('/api/showers').then(r => r.json());
        } catch (e) {
            console.error(e);
        }
    }

    const s = state.stats || {};
    document.getElementById('metric-total').textContent = (s.total_meteors || 0).toLocaleString();
    document.getElementById('metric-known').textContent = (s.known_showers || 0).toLocaleString();
    document.getElementById('metric-sporadic').textContent = (s.sporadic || 0).toLocaleString();
    document.getElementById('metric-unique').textContent = s.unique_showers || 0;
    document.getElementById('metric-peak').textContent = s.avg_peak != null ? s.avg_peak.toFixed(2) : '0';
    document.getElementById('metric-velocity').textContent = s.avg_velocity != null ? s.avg_velocity.toFixed(1) : '0';

    // Render Bar Chart (Top Showers)
    const chartContainer = document.getElementById('shower-chart');
    if (chartContainer && s.top_showers) {
        chartContainer.innerHTML = '';
        const maxVal = Math.max(...s.top_showers.map(item => item.count), 1);
        s.top_showers.slice(0, 8).forEach(item => {
            const pct = (item.count / maxVal) * 100;
            const row = document.createElement('div');
            row.className = 'bar-row';
            row.innerHTML = `
                <span class="bar-label" title="${item.name}">${item.name}</span>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${pct}%"></div>
                </div>
                <span class="bar-count">${item.count}</span>
            `;
            chartContainer.appendChild(row);
        });
    }

    // Render Timeline Canvas
    renderTimelineChart();

    // Render Pie/Donut Canvas
    renderDistributionChart();

    // Render Known Showers Table
    const tbody = document.querySelector('#showers-table tbody');
    if (tbody && state.showers) {
        tbody.innerHTML = '';
        state.showers.slice(0, 15).forEach(shower => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${shower.name}</strong></td>
                <td><span class="badge badge-known">${shower.count}</span></td>
                <td>${shower.avg_peak != null ? shower.avg_peak.toFixed(2) : '-'}</td>
                <td>${shower.avg_duration != null ? shower.avg_duration.toFixed(2) : '-'}</td>
                <td>${shower.avg_velocity != null ? shower.avg_velocity.toFixed(1) : '-'}</td>
                <td>${shower.avg_mass != null ? shower.avg_mass.toExponential(2) : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Activity Timeline Canvas Chart
async function renderTimelineChart() {
    const canvas = document.getElementById('timeline-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth - 44;
    const height = canvas.height = 240;

    let timelineData = [];
    try {
        timelineData = await fetch('/api/shower_timeline').then(r => r.json());
    } catch (e) {
        console.error(e);
    }

    ctx.clearRect(0, 0, width, height);
    if (!timelineData || timelineData.length === 0) return;

    const maxCount = Math.max(...timelineData.map(d => d.count), 1);
    const padding = 35;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + (graphHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px Inter';
        const val = Math.round(maxCount * (1 - i / 4));
        ctx.fillText(val.toString(), 8, y + 3);
    }

    // Draw Line Graph with Gradient
    ctx.beginPath();
    timelineData.forEach((pt, i) => {
        const x = padding + (i / (timelineData.length - 1)) * graphWidth;
        const y = padding + graphHeight - (pt.count / maxCount) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });

    // Create Gradient fill below curve
    ctx.lineTo(width - padding, padding + graphHeight);
    ctx.lineTo(padding, padding + graphHeight);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padding, 0, height);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.35)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Curve Stroke
    ctx.beginPath();
    timelineData.forEach((pt, i) => {
        const x = padding + (i / (timelineData.length - 1)) * graphWidth;
        const y = padding + graphHeight - (pt.count / maxCount) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;
    ctx.stroke();
}

// Shower Distribution Donut Chart
function renderDistributionChart() {
    const canvas = document.getElementById('pie-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth - 44;
    const height = canvas.height = 240;

    ctx.clearRect(0, 0, width, height);
    if (!state.showers || state.showers.length === 0) return;

    const top6 = state.showers.slice(0, 5);
    const othersCount = state.showers.slice(5).reduce((sum, s) => sum + s.count, 0);
    const slices = [...top6.map(s => ({ name: s.name, count: s.count })), { name: 'Others', count: othersCount }];
    const total = slices.reduce((sum, s) => sum + s.count, 0) || 1;

    const colors = ['#6366f1', '#00f0ff', '#f72585', '#ffb703', '#10b981', '#fb8500'];
    const centerX = width * 0.35;
    const centerY = height / 2;
    const outerRadius = 75;
    const innerRadius = 45;

    let currentAngle = -Math.PI / 2;
    slices.forEach((slice, idx) => {
        const sliceAngle = (slice.count / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
        ctx.arc(centerX, centerY, innerRadius, currentAngle + sliceAngle, currentAngle, true);
        ctx.closePath();
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fill();
        currentAngle += sliceAngle;
    });

    // Legend
    const legendX = width * 0.65;
    const legendY = 30;
    slices.forEach((slice, idx) => {
        const y = legendY + idx * 30;
        ctx.fillStyle = colors[idx % colors.length];
        ctx.fillRect(legendX, y, 12, 12);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '11px Inter';
        const pct = ((slice.count / total) * 100).toFixed(1);
        ctx.fillText(`${slice.name.substring(0, 14)} (${pct}%)`, legendX + 20, y + 10);
    });
}

// Prediction Form & Engine
function setupEventListeners() {
    // 3D Controls
    document.getElementById('toggle-stars')?.addEventListener('click', () => {
        state.showStars = !state.showStars;
        if (starField) starField.visible = state.showStars;
        document.getElementById('toggle-stars').classList.toggle('active', state.showStars);
    });

    document.getElementById('toggle-trails')?.addEventListener('click', () => {
        state.showTrails = !state.showTrails;
        if (trailGroup) trailGroup.visible = state.showTrails;
        document.getElementById('toggle-trails').classList.toggle('active', state.showTrails);
    });

    document.getElementById('toggle-earth')?.addEventListener('click', () => {
        state.showEarth = !state.showEarth;
        if (earthMesh) earthMesh.visible = state.showEarth;
        if (atmosphereMesh) atmosphereMesh.visible = state.showEarth;
        document.getElementById('toggle-earth').classList.toggle('active', state.showEarth);
    });

    document.getElementById('toggle-animation')?.addEventListener('click', () => {
        state.animationRunning = !state.animationRunning;
        document.getElementById('toggle-animation').textContent = state.animationRunning ? '⏸️' : '▶️';
    });

    document.getElementById('reset-camera')?.addEventListener('click', () => {
        camera.position.set(0, 5, 9);
        controls.target.set(0, 0, 0);
    });

    document.getElementById('speed-slider')?.addEventListener('input', (e) => {
        state.speedMultiplier = parseFloat(e.target.value);
        document.getElementById('speed-val').textContent = `${state.speedMultiplier.toFixed(1)}x`;
    });

    document.getElementById('density-btn')?.addEventListener('click', async () => {
        state.densityLimit = state.densityLimit >= 800 ? 200 : state.densityLimit + 300;
        document.getElementById('density-val').textContent = state.densityLimit;
        await load3DData();
    });

    // Prediction actions
    document.getElementById('btn-random')?.addEventListener('click', randomizePredictionFields);
    document.getElementById('btn-reset')?.addEventListener('click', resetPredictionFields);
    document.getElementById('btn-predict')?.addEventListener('click', runPrediction);

    // Data explorer search and filter
    let debounceTimer;
    document.getElementById('search-input')?.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.searchQuery = e.target.value.trim();
            state.page = 1;
            fetchMeteorTableData();
        }, 350);
    });

    document.getElementById('shower-filter')?.addEventListener('change', (e) => {
        state.showerFilter = e.target.value;
        state.page = 1;
        fetchMeteorTableData();
    });

    document.getElementById('btn-prev')?.addEventListener('click', () => {
        if (state.page > 1) {
            state.page--;
            fetchMeteorTableData();
        }
    });

    document.getElementById('btn-next')?.addEventListener('click', () => {
        state.page++;
        fetchMeteorTableData();
    });

    // Modal close
    document.querySelectorAll('[data-close]').forEach(elem => {
        elem.addEventListener('click', () => {
            document.getElementById('modal').classList.add('hidden');
        });
    });
}

function randomizePredictionFields() {
    const samples = [
        { solLon: 140.2, ra: 46.2, dec: 57.6, vgeo: 59.2, dur: 0.65, peak: 1.2, a: 8.5, e: 0.94, i: 113.1 },
        { solLon: 262.1, ra: 112.5, dec: 32.8, vgeo: 34.5, dur: 0.42, peak: 2.1, a: 1.34, e: 0.89, i: 23.6 },
        { solLon: 283.5, ra: 230.1, dec: 49.3, vgeo: 42.1, dur: 0.55, peak: 0.8, a: 3.12, e: 0.68, i: 71.4 },
        { solLon: 234.8, ra: 153.2, dec: 21.9, vgeo: 70.8, dur: 0.85, peak: -1.5, a: 10.3, e: 0.90, i: 162.5 }
    ];
    const s = samples[Math.floor(Math.random() * samples.length)];
    document.getElementById('f-sol-lon').value = (s.solLon + (Math.random() - 0.5) * 5).toFixed(1);
    document.getElementById('f-rageo').value = (s.ra + (Math.random() - 0.5) * 4).toFixed(1);
    document.getElementById('f-decgeo').value = (s.dec + (Math.random() - 0.5) * 3).toFixed(1);
    document.getElementById('f-vgeo').value = s.vgeo.toFixed(1);
    document.getElementById('f-dur').value = s.dur.toFixed(2);
    document.getElementById('f-peak').value = s.peak.toFixed(1);
    document.getElementById('f-a').value = s.a.toFixed(2);
    document.getElementById('f-e').value = s.e.toFixed(2);
    document.getElementById('f-i').value = s.i.toFixed(1);
}

function resetPredictionFields() {
    document.getElementById('f-sol-lon').value = '280';
    document.getElementById('f-rageo').value = '150';
    document.getElementById('f-decgeo').value = '30';
    document.getElementById('f-latbeg').value = '45';
    document.getElementById('f-lonbeg').value = '10';
    document.getElementById('f-htbeg').value = '100';
    document.getElementById('f-vgeo').value = '40';
    document.getElementById('f-lamhel').value = '100';
    document.getElementById('f-bethel').value = '30';
    document.getElementById('f-vhel').value = '35';
    document.getElementById('f-a').value = '2.5';
    document.getElementById('f-e').value = '0.8';
    document.getElementById('f-i').value = '45';
    document.getElementById('f-peri').value = '150';
    document.getElementById('f-node').value = '100';
    document.getElementById('f-pi').value = '200';
    document.getElementById('f-q').value = '0.5';
    document.getElementById('f-Q').value = '4.0';
    document.getElementById('f-tiss').value = '2.5';
    document.getElementById('f-dur').value = '0.5';
    document.getElementById('f-peak').value = '3';
    document.getElementById('f-vavg').value = '45';
    document.getElementById('f-mass').value = '0.0001';
}

async function runPrediction() {
    const btn = document.getElementById('btn-predict');
    const spinner = btn?.querySelector('.btn-spinner');
    if (spinner) spinner.classList.remove('hidden');

    const inputData = {
        'Sol_lon': parseFloat(document.getElementById('f-sol-lon').value) || 0,
        'RAgeo': parseFloat(document.getElementById('f-rageo').value) || 0,
        'DECgeo': parseFloat(document.getElementById('f-decgeo').value) || 0,
        'LatBeg': parseFloat(document.getElementById('f-latbeg').value) || 0,
        'LonBeg': parseFloat(document.getElementById('f-lonbeg').value) || 0,
        'HtBeg': parseFloat(document.getElementById('f-htbeg').value) || 0,
        'Vgeo': parseFloat(document.getElementById('f-vgeo').value) || 0,
        'LAMhel': parseFloat(document.getElementById('f-lamhel').value) || 0,
        'BEThel': parseFloat(document.getElementById('f-bethel').value) || 0,
        'Vhel': parseFloat(document.getElementById('f-vhel').value) || 0,
        'a': parseFloat(document.getElementById('f-a').value) || 0,
        'e': parseFloat(document.getElementById('f-e').value) || 0,
        'i': parseFloat(document.getElementById('f-i').value) || 0,
        'peri': parseFloat(document.getElementById('f-peri').value) || 0,
        'node': parseFloat(document.getElementById('f-node').value) || 0,
        'Pi': parseFloat(document.getElementById('f-pi').value) || 0,
        'q': parseFloat(document.getElementById('f-q').value) || 0,
        'Q': parseFloat(document.getElementById('f-Q').value) || 0,
        'TisserandJ': parseFloat(document.getElementById('f-tiss').value) || 0,
        'Duration': parseFloat(document.getElementById('f-dur').value) || 0.5,
        'Peak': parseFloat(document.getElementById('f-peak').value) || 3,
        'Vavg': parseFloat(document.getElementById('f-vavg').value) || 45,
        'Mass_kg': parseFloat(document.getElementById('f-mass').value) || 0.0001,
        'HtEnd': 70.0
    };

    try {
        const res = await fetch('/api/predict/comprehensive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inputData)
        });

        if (!res.ok) throw new Error('Prediction API failed');
        const outcome = await res.json();
        renderPredictionOutcome(outcome);
    } catch (err) {
        console.error(err);
        alert('Prediction request failed: ' + err.message);
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}

function renderPredictionOutcome(outcome) {
    const container = document.getElementById('predict-results');
    if (!container) return;

    const shower = outcome.shower_prediction || {};
    const showerName = shower.predicted_shower || 'Sporadic';
    const confidencePct = ((shower.confidence || 0) * 100).toFixed(1);
    const topCandidates = shower.top_predictions || [];

    const peakMag = outcome.peak_magnitude?.value != null ? outcome.peak_magnitude.value.toFixed(2) : '-';
    const peakClass = outcome.peak_magnitude?.intensity_class || 'Standard';
    const duration = outcome.duration?.formatted || `${(outcome.duration?.seconds || 0).toFixed(2)}s`;
    const energyJoules = outcome.estimated_energy_joules != null ? outcome.estimated_energy_joules.toExponential(2) : '-';
    const energyTnt = outcome.estimated_energy_tnt_kg != null ? outcome.estimated_energy_tnt_kg.toFixed(3) : '-';
    const riskLevel = outcome.risk_assessment?.level || 'Low';

    container.innerHTML = `
        <div class="card result-card">
            <h3>📊 Prediction Results</h3>
            <div class="prediction-outcome">
                <div class="highlight-box">
                    <div class="highlight-title">Classified Meteor Shower</div>
                    <div class="highlight-value">${showerName}</div>
                    <div class="highlight-sub">Confidence: <strong>${confidencePct}%</strong></div>
                </div>

                <div class="outcome-grid">
                    <div class="outcome-item">
                        <div class="outcome-label">Peak Magnitude</div>
                        <div class="outcome-val">${peakMag} <span style="font-size:0.75rem; color:var(--accent);">(${peakClass})</span></div>
                    </div>
                    <div class="outcome-item">
                        <div class="outcome-label">Predicted Duration</div>
                        <div class="outcome-val">${duration}</div>
                    </div>
                    <div class="outcome-item">
                        <div class="outcome-label">Kinetic Energy</div>
                        <div class="outcome-val">${energyJoules} J</div>
                    </div>
                    <div class="outcome-item">
                        <div class="outcome-label">Risk Level</div>
                        <div class="outcome-val"><span class="badge ${riskLevel === 'Low' ? 'badge-known' : 'badge-sporadic'}">${riskLevel}</span></div>
                    </div>
                </div>

                <div class="top-candidates">
                    <h4 style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">Top Shower Probabilities</h4>
                    <div class="prob-list">
                        ${topCandidates.map(([name, prob]) => {
                            const p = (prob * 100).toFixed(1);
                            return `
                                <div class="prob-item">
                                    <span class="prob-name" title="${name}">${name}</span>
                                    <div class="prob-bar"><div class="prob-bar-fill" style="width:${p}%"></div></div>
                                    <span class="prob-percent">${p}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Data Explorer Table & Details
async function fetchMeteorTableData() {
    const tbody = document.querySelector('#meteors-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Loading meteor observations...</td></tr>';

    try {
        const queryParams = new URLSearchParams({
            page: state.page,
            per_page: state.perPage,
            search: state.searchQuery,
            shower: state.showerFilter
        });

        const res = await fetch(`/api/meteors?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Data fetch failed');
        const json = await res.json();

        state.totalRecords = json.total || 0;
        const meteors = json.data || [];

        // Pager update
        const start = (state.page - 1) * state.perPage + 1;
        const end = Math.min(state.page * state.perPage, state.totalRecords);
        document.getElementById('page-info').textContent = `Showing ${state.totalRecords === 0 ? 0 : start}-${end} of ${state.totalRecords.toLocaleString()}`;
        document.getElementById('page-number').textContent = `Page ${state.page}`;
        document.getElementById('btn-prev').disabled = state.page <= 1;
        document.getElementById('btn-next').disabled = end >= state.totalRecords;

        if (meteors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted);">No meteors matched your criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        meteors.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><code>${m.id}</code></td>
                <td><strong>${m.iau_shower || 'Sporadic'}</strong></td>
                <td><span class="badge ${m.category === 'Known' ? 'badge-known' : 'badge-sporadic'}">${m.category}</span></td>
                <td>${m.sol_lon != null ? m.sol_lon.toFixed(2) : '-'}°</td>
                <td>${m.rageo != null ? m.rageo.toFixed(1) : '-'}/${m.decgeo != null ? m.decgeo.toFixed(1) : '-'}</td>
                <td>${m.vgeo != null ? m.vgeo.toFixed(1) : '-'}</td>
                <td>${m.peak != null ? m.peak.toFixed(1) : '-'}</td>
                <td>${m.duration != null ? m.duration.toFixed(2) + 's' : '-'}</td>
                <td>${m.lat_beg != null ? m.lat_beg.toFixed(1) : '-'}/${m.lon_beg != null ? m.lon_beg.toFixed(1) : '-'}</td>
                <td><button class="btn btn-secondary btn-small view-detail-btn" data-id="${m.id}">Inspect</button></td>
            `;
            tbody.appendChild(tr);
        });

        document.querySelectorAll('.view-detail-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openMeteorModal(id);
            });
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="10" style="color:#ef4444; text-align:center;">Failed to load data: ${err.message}</td></tr>`;
    }
}

async function openMeteorModal(id) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    modal.classList.remove('hidden');
    body.innerHTML = '<p style="color:var(--text-muted); padding:20px;">Fetching trajectory telemetry...</p>';
    document.getElementById('modal-title').textContent = `Meteor Telemetry: ${id}`;

    try {
        const res = await fetch(`/api/meteors/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error('Could not fetch details');
        const detail = await res.json();

        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><div class="detail-label">Trajectory ID</div><div class="detail-val">${detail['Unique trajectory'] || id}</div></div>
                <div class="detail-item"><div class="detail-label">Shower Name</div><div class="detail-val">${detail['IAU_Shower'] || 'Sporadic'}</div></div>
                <div class="detail-item"><div class="detail-label">Solar Longitude</div><div class="detail-val">${detail['Sol_lon'] ?? '-'}°</div></div>
                <div class="detail-item"><div class="detail-label">Geocentric Velocity</div><div class="detail-val">${detail['Vgeo'] ?? '-'} km/s</div></div>
                <div class="detail-item"><div class="detail-label">Peak Magnitude</div><div class="detail-val">${detail['Peak'] ?? '-'}</div></div>
                <div class="detail-item"><div class="detail-label">Duration</div><div class="detail-val">${detail['Duration'] ?? '-'} s</div></div>
                <div class="detail-item"><div class="detail-label">Height Begin</div><div class="detail-val">${detail['HtBeg'] ?? '-'} km</div></div>
                <div class="detail-item"><div class="detail-label">Height End</div><div class="detail-val">${detail['HtEnd'] ?? '-'} km</div></div>
                <div class="detail-item"><div class="detail-label">Semi-major axis (a)</div><div class="detail-val">${detail['a'] ?? '-'} AU</div></div>
                <div class="detail-item"><div class="detail-label">Eccentricity (e)</div><div class="detail-val">${detail['e'] ?? '-'}</div></div>
                <div class="detail-item"><div class="detail-label">Inclination (i)</div><div class="detail-val">${detail['i'] ?? '-'}°</div></div>
                <div class="detail-item"><div class="detail-label">Perihelion (q)</div><div class="detail-val">${detail['q'] ?? '-'} AU</div></div>
            </div>
        `;
    } catch (err) {
        body.innerHTML = `<p style="color:#ef4444; padding:20px;">Failed to load details: ${err.message}</p>`;
    }
}
