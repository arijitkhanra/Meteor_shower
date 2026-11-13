import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================================================
// APPLICATION STATE
// ==========================================================================
const state = {
    currentView: '3d',
    dataLoaded: false,
    stats: null,
    modelInfo: null,
    showers: [],
    meteors3DData: [],
    activeMeteors: [],
    groundImpactMarkers: [],
    animationRunning: true,
    speedMultiplier: 1.0,
    densityLimit: 300,
    showStars: true,
    showTrails: true,
    showEarth: true,
    showGrid: true,
    showClouds: true,
    showAtmos: true,
    activeStreamFilter: 'QUA',
    selectedDate: '2025-01-03',
    calendarYear: 2025,
    calendarMonth: 1,
    page: 1,
    perPage: 50,
    searchQuery: '',
    dataShowerFilter: '',
    totalRecords: 4733
};

// ==========================================================================
// THREE.JS SCENE GLOBALS
// ==========================================================================
let scene, camera, renderer, controls;
let earthGroup, earthMesh, cloudsMesh, atmosMesh, gridMesh;
let starField, meteorGroup, trailGroup, impactGroup;
let raycaster, mouse;
let clock = new THREE.Clock();
let fpsFrames = 0, fpsTime = 0;
let earthRadius = 2.6;

// Major Annual Showers Catalog (Client-Side Quick Reference)
const MAJOR_SHOWERS_CATALOG = [
    { code: 'QUA', name: 'Quadrantids', dates: 'Jan 01 - Jan 05', peak: 'Jan 03-04', zhr: 110, ra: 230.1, dec: 49.5, vel: 41.2, tier: 'High', color: '#00f0ff' },
    { code: 'LYR', name: 'Lyrids', dates: 'Apr 16 - Apr 25', peak: 'Apr 22', zhr: 18, ra: 271.4, dec: 33.6, vel: 46.8, tier: 'Medium', color: '#2dd4bf' },
    { code: 'ETA', name: 'eta Aquariids', dates: 'Apr 19 - May 28', peak: 'May 06', zhr: 50, ra: 338.0, dec: -1.0, vel: 66.0, tier: 'Medium', color: '#34d399' },
    { code: 'SDA', name: 'Southern delta Aquariids', dates: 'Jul 12 - Aug 23', peak: 'Jul 30', zhr: 25, ra: 339.6, dec: -16.4, vel: 41.0, tier: 'Medium', color: '#fb923c' },
    { code: 'PER', name: 'Perseids', dates: 'Jul 17 - Aug 24', peak: 'Aug 12-13', zhr: 100, ra: 48.2, dec: 58.1, vel: 59.0, tier: 'High', color: '#f43f5e' },
    { code: 'ORI', name: 'Orionids', dates: 'Oct 02 - Nov 07', peak: 'Oct 21-22', zhr: 20, ra: 95.0, dec: 16.0, vel: 66.0, tier: 'Medium', color: '#e879f9' },
    { code: 'LEO', name: 'Leonids', dates: 'Nov 06 - Nov 30', peak: 'Nov 17-18', zhr: 15, ra: 152.0, dec: 22.0, vel: 71.0, tier: 'Medium', color: '#facc15' },
    { code: 'GEM', name: 'Geminids', dates: 'Dec 04 - Dec 20', peak: 'Dec 13-14', zhr: 150, ra: 112.3, dec: 33.0, vel: 35.0, tier: 'High', color: '#fbbf24' },
    { code: 'URS', name: 'Ursids', dates: 'Dec 17 - Dec 26', peak: 'Dec 22-23', zhr: 10, ra: 217.0, dec: 76.0, vel: 33.0, tier: 'Low', color: '#38bdf8' }
];

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initThreeScene();
    setupEventListeners();
    await loadInitialData();
    hideLoadingScreen();
    animate();
});

function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => {
            loader.style.display = 'none';
            if (app) app.style.display = 'block';
            onWindowResize();
        }, 500);
    }
}

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
    } else if (viewName === 'model') {
        renderModelView();
    } else if (viewName === 'data') {
        fetchMeteorTableData();
    }
}

// ==========================================================================
// THREE.JS 3D SCENE SETUP
// ==========================================================================
function initThreeScene() {
    const container = document.getElementById('scene-container');
    if (!container) return;

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.012);

    camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 2.5, 7.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 25;
    controls.minDistance = 3.2;
    controls.target.set(0, 0, 0);

    // Cosmic Lighting
    const ambientLight = new THREE.AmbientLight(0x1a2544, 1.2);
    scene.add(ambientLight);

    // Primary Sun directional light
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.5);
    sunLight.position.set(18, 8, 14);
    scene.add(sunLight);

    // Soft rim back-light for atmospheric glow
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
    rimLight.position.set(-15, -6, -10);
    scene.add(rimLight);

    // Groups
    earthGroup = new THREE.Group();
    meteorGroup = new THREE.Group();
    trailGroup = new THREE.Group();
    impactGroup = new THREE.Group();

    scene.add(earthGroup);
    scene.add(meteorGroup);
    scene.add(trailGroup);
    scene.add(impactGroup);

    // Build Realistic 3D World
    createStarfield();
    createRealisticEarth();

    // Raycasting for interactive hover over meteors and impact points
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
}

// ==========================================================================
// HIGH-REALISM PROCEDURAL 3D EARTH GENERATOR
// ==========================================================================
function createRealisticEarth() {
    // 1. Procedural High-Detail Earth Surface Texture
    const earthCanvas = generateEarthMapCanvas();
    const earthTexture = new THREE.CanvasTexture(earthCanvas);
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Earth Sphere Geometry
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
        map: earthTexture,
        shininess: 28,
        specular: new THREE.Color(0x224488)
    });

    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 2. Latitude & Longitude Coordinate Grid (Area Visibility)
    const gridCanvas = generateCoordinateGridCanvas();
    const gridTexture = new THREE.CanvasTexture(gridCanvas);
    const gridGeo = new THREE.SphereGeometry(earthRadius * 1.002, 64, 64);
    const gridMat = new THREE.MeshBasicMaterial({
        map: gridTexture,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending
    });
    gridMesh = new THREE.Mesh(gridGeo, gridMat);
    earthGroup.add(gridMesh);

    // 3. Dynamic Swirling Clouds Layer
    const cloudsCanvas = generateCloudsCanvas();
    const cloudsTexture = new THREE.CanvasTexture(cloudsCanvas);
    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.018, 64, 64);
    const cloudsMat = new THREE.MeshPhongMaterial({
        map: cloudsTexture,
        transparent: true,
        opacity: 0.42,
        blending: THREE.NormalBlending,
        depthWrite: false
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    // 4. Atmospheric Rayleigh Scattering Halo
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.045, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormal;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vNormal;
            void main() {
                float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
                gl_FragColor = vec4(0.0, 0.85, 1.0, 1.0) * intensity * 0.9;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });
    atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // Slightly tilt Earth on its astronomical rotational axis (23.5 degrees)
    earthGroup.rotation.z = THREE.MathUtils.degToRad(23.44);
}

// Procedural Equirectangular Earth Surface Canvas
function generateEarthMapCanvas() {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Deep Ocean Background with Bathymetric Gradients
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
    oceanGrad.addColorStop(0.0, '#091c33'); // Arctic
    oceanGrad.addColorStop(0.2, '#0c2747');
    oceanGrad.addColorStop(0.5, '#0f3259'); // Tropical
    oceanGrad.addColorStop(0.8, '#0c2747');
    oceanGrad.addColorStop(1.0, '#091c33'); // Antarctic
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, width, height);

    // Coastline reef glow
    ctx.strokeStyle = '#145070';
    ctx.lineWidth = 4;

    // Helper to draw geographic polygons using Lon (-180..180) and Lat (-90..90)
    function drawGeoPoly(coords, fillColor, strokeColor = '#1a6080') {
        ctx.beginPath();
        for (let i = 0; i < coords.length; i++) {
            const lon = coords[i][0];
            const lat = coords[i][1];
            const x = ((lon + 180) / 360) * width;
            const y = ((90 - lat) / 180) * height;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        if (strokeColor) {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    // 1. North America
    drawGeoPoly([
        [-168, 66], [-160, 71], [-140, 70], [-125, 70], [-95, 70], [-80, 62],
        [-65, 58], [-55, 52], [-66, 44], [-75, 35], [-81, 25], [-80, 25],
        [-90, 29], [-97, 26], [-105, 20], [-95, 16], [-85, 12], [-83, 9],
        [-88, 14], [-105, 22], [-115, 30], [-124, 40], [-125, 50], [-135, 57],
        [-150, 60], [-168, 66]
    ], '#2d6a36');

    // 2. Greenland (Ice Cap)
    drawGeoPoly([
        [-50, 83], [-20, 80], [-25, 70], [-42, 60], [-55, 68], [-50, 83]
    ], '#eaf3f8', '#cbd5e1');

    // 3. South America
    drawGeoPoly([
        [-76, 12], [-60, 8], [-50, 0], [-35, -5], [-37, -12], [-42, -23],
        [-52, -32], [-65, -45], [-70, -54], [-75, -50], [-72, -40], [-71, -30],
        [-77, -12], [-81, -4], [-77, 8], [-76, 12]
    ], '#256030');

    // 4. Eurasia (Europe + Asia + Middle East + Siberia)
    drawGeoPoly([
        [-9, 36], [-2, 43], [4, 44], [9, 54], [15, 56], [28, 71],
        [40, 68], [60, 73], [100, 76], [140, 72], [170, 66], [180, 65],
        [160, 52], [140, 48], [130, 36], [120, 32], [108, 22], [105, 10],
        [98, 8], [90, 22], [80, 13], [70, 24], [60, 25], [52, 26],
        [44, 13], [35, 32], [28, 41], [15, 40], [0, 42], [-9, 36]
    ], '#356d3b');

    // 4b. Sahara & Arabian Deserts
    drawGeoPoly([
        [-15, 28], [0, 32], [15, 32], [32, 30], [55, 24], [58, 20],
        [50, 14], [43, 12], [32, 16], [15, 18], [-15, 18], [-15, 28]
    ], '#b88a44', '#8a652a');

    // 5. Africa
    drawGeoPoly([
        [-17, 15], [-5, 5], [9, 4], [10, -5], [12, -16], [18, -34],
        [28, -34], [33, -26], [40, -10], [51, 11], [43, 12], [32, 30],
        [15, 32], [0, 35], [-5, 36], [-12, 28], [-17, 15]
    ], '#3d6e38');

    // 6. Australia
    drawGeoPoly([
        [114, -22], [125, -15], [136, -12], [142, -11], [153, -28],
        [150, -37], [138, -35], [130, -32], [115, -34], [113, -26], [114, -22]
    ], '#b06535');

    // 7. Antarctica (Ice Continent)
    drawGeoPoly([
        [-180, -78], [-120, -74], [-60, -65], [0, -70], [60, -67], [120, -66], [180, -78],
        [180, -90], [-180, -90]
    ], '#f1f7fc', '#e2e8f0');

    // Mountain Textures / Highlands (Himalayas, Andes, Rockies)
    ctx.fillStyle = '#6b5742';
    ctx.beginPath();
    ctx.arc(((85 + 180) / 360) * width, ((90 - 30) / 180) * height, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(((-70 + 180) / 360) * width, ((90 - -25) / 180) * height, 16, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
}

// Coordinate Grid Canvas (Lat / Lon lines & labels)
function generateCoordinateGridCanvas() {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);

    // Parallels (Latitude lines every 15°)
    for (let lat = -75; lat <= 75; lat += 15) {
        const y = ((90 - lat) / 180) * height;
        ctx.beginPath();
        if (lat === 0) {
            // Equator (Prominent Gold/Cyan)
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
            ctx.lineWidth = 2.5;
        } else if (Math.abs(lat) === 23.5) {
            // Tropics of Cancer & Capricorn
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
            ctx.lineWidth = 1.8;
        } else {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
            ctx.lineWidth = 1.0;
        }
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.font = '14px Orbitron, sans-serif';
        const label = lat === 0 ? 'EQUATOR 0°' : (lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`);
        ctx.fillText(label, 20, y - 4);
    }

    // Meridians (Longitude lines every 30°)
    for (let lon = -180; lon < 180; lon += 30) {
        const x = ((lon + 180) / 360) * width;
        ctx.beginPath();
        if (lon === 0) {
            // Prime Meridian
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
            ctx.lineWidth = 2.0;
        } else {
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
            ctx.lineWidth = 1.0;
        }
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Label
        ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.font = '12px Orbitron, sans-serif';
        const label = lon === 0 ? '0° PRIME' : (lon > 0 ? `${lon}°E` : `${Math.abs(lon)}°W`);
        ctx.fillText(label, x + 4, height - 12);
    }

    return canvas;
}

// Procedural Atmospheric Cloud Cover Canvas
function generateCloudsCanvas() {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);

    // Tropical ITCZ equatorial cloud band
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * width;
        const y = height * 0.48 + (Math.random() - 0.5) * 80;
        const rx = 80 + Math.random() * 140;
        const ry = 15 + Math.random() * 30;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Mid-latitude cyclonic storm spirals
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = (Math.random() > 0.5 ? height * 0.25 : height * 0.72) + (Math.random() - 0.5) * 100;
        const rx = 60 + Math.random() * 120;
        const ry = 25 + Math.random() * 50;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, Math.random() * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    return canvas;
}

function createStarfield() {
    const starCount = 2500;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        const radius = 60 + Math.random() * 80;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);

        const tint = Math.random();
        if (tint > 0.8) {
            colors[i] = 0.5; colors[i + 1] = 0.85; colors[i + 2] = 1.0; // Cyan
        } else if (tint > 0.6) {
            colors[i] = 1.0; colors[i + 1] = 0.85; colors[i + 2] = 0.5; // Gold
        } else {
            colors[i] = 0.95; colors[i + 1] = 0.95; colors[i + 2] = 1.0; // White
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.9
    });

    starField = new THREE.Points(geometry, material);
    scene.add(starField);
}

// Convert Geographical Latitude, Longitude, Altitude to 3D Vector
function geoToVector3(lat, lon, altitude = earthRadius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(altitude * Math.sin(phi) * Math.cos(theta));
    const z = (altitude * Math.sin(phi) * Math.sin(theta));
    const y = (altitude * Math.cos(phi));

    return new THREE.Vector3(x, y, z);
}

// Convert Radiant Coordinates (RA, DEC) to Direction Vector in Space
function radiantToDirectionVector(ra, dec) {
    const raRad = THREE.MathUtils.degToRad(ra);
    const decRad = THREE.MathUtils.degToRad(dec);

    const x = Math.cos(decRad) * Math.cos(raRad);
    const y = Math.sin(decRad);
    const z = Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z).normalize();
}

// ==========================================================================
// REALISTIC METEOR STREAK GENERATOR & PARTICLE SYSTEM
// ==========================================================================
class RealisticMeteor {
    constructor(data) {
        this.data = data;
        this.active = false;
        this.progress = 0;
        this.lifeTime = 0.8 + Math.random() * 0.9;
        this.speed = (0.7 + (data.vgeo || 40) / 80.0) * 0.015;

        // Radiant direction
        const dir = radiantToDirectionVector(data.rageo || 230, data.decgeo || 49);
        this.radiantDir = dir.clone();

        // Start position in outer space (6 to 11 units from Earth)
        const spawnDistance = 7.5 + Math.random() * 4.0;
        // Perturb entry angle slightly around radiant
        const offset = new THREE.Vector3(
            (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 3.5,
            (Math.random() - 0.5) * 3.5
        );
        this.startPos = dir.clone().multiplyScalar(spawnDistance).add(offset);

        // Target: atmospheric entry shell near Earth (radius ~2.72)
        const targetDir = offset.clone().normalize();
        this.endPos = targetDir.multiplyScalar(earthRadius * 1.04);

        // Meteor Head Particle
        const headGeo = new THREE.SphereGeometry(Math.max(0.04, Math.min(0.12, (data.size || 0.08) * 1.2)), 12, 12);
        const col = new THREE.Color(data.color?.r ?? 0.0, data.color?.g ?? 0.94, data.color?.b ?? 1.0);
        const headMat = new THREE.MeshBasicMaterial({ color: col });
        this.headMesh = new THREE.Mesh(headGeo, headMat);
        this.headMesh.userData = data;

        // Glowing streak trail
        this.trailLength = 25;
        this.trailPositions = new Float32Array(this.trailLength * 3);
        this.trailColors = new Float32Array(this.trailLength * 3);

        for (let i = 0; i < this.trailLength * 3; i += 3) {
            this.trailPositions[i] = this.startPos.x;
            this.trailPositions[i + 1] = this.startPos.y;
            this.trailPositions[i + 2] = this.startPos.z;

            const ratio = 1 - (i / (this.trailLength * 3));
            this.trailColors[i] = col.r * ratio;
            this.trailColors[i + 1] = col.g * ratio;
            this.trailColors[i + 2] = col.b * ratio;
        }

        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

        const trailMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            linewidth: 2
        });

        this.trailLine = new THREE.Line(trailGeo, trailMat);

        meteorGroup.add(this.headMesh);
        trailGroup.add(this.trailLine);

        this.currentPos = this.startPos.clone();
        this.history = [];
    }

    reset() {
        this.progress = 0;
        this.active = true;
        this.history = [];
    }

    update(effectiveSpeed) {
        if (!this.active) return;

        this.progress += this.speed * effectiveSpeed;

        if (this.progress >= 1.0) {
            // Reached atmosphere -> flare up & dissipate
            this.active = false;
            this.headMesh.visible = false;
            this.trailLine.visible = false;
            return;
        }

        this.headMesh.visible = true;
        this.trailLine.visible = state.showTrails;

        // Current interpolated flight position
        this.currentPos.lerpVectors(this.startPos, this.endPos, this.progress);
        this.headMesh.position.copy(this.currentPos);

        // Peak brightness flare as it penetrates atmospheric boundary (distance to center <= 2.9)
        const distToCenter = this.currentPos.length();
        if (distToCenter < earthRadius * 1.15) {
            const scale = 1.0 + Math.sin(this.progress * Math.PI) * 1.8;
            this.headMesh.scale.set(scale, scale, scale);
        }

        // Update trail positions history
        this.history.unshift(this.currentPos.clone());
        if (this.history.length > this.trailLength) {
            this.history.pop();
        }

        const posAttr = this.trailLine.geometry.attributes.position;
        for (let i = 0; i < this.history.length; i++) {
            posAttr.setXYZ(i, this.history[i].x, this.history[i].y, this.history[i].z);
        }
        for (let i = this.history.length; i < this.trailLength; i++) {
            posAttr.setXYZ(i, this.currentPos.x, this.currentPos.y, this.currentPos.z);
        }
        posAttr.needsUpdate = true;
    }

    destroy() {
        meteorGroup.remove(this.headMesh);
        trailGroup.remove(this.trailLine);
        this.headMesh.geometry.dispose();
        this.headMesh.material.dispose();
        this.trailLine.geometry.dispose();
        this.trailLine.material.dispose();
    }
}

// Load 3D Meteor Shower Data & Initialize Simulation
async function load3DData(filter = state.activeStreamFilter) {
    try {
        const url = `/api/3d-data?limit=${state.densityLimit}${filter && filter !== 'ALL' ? `&shower=${filter}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load 3d meteor data');
        const data = await res.json();
        state.meteors3DData = data.meteors || [];

        // Clear existing meteor instances
        state.activeMeteors.forEach(m => m.destroy());
        state.activeMeteors = [];

        // Clear existing impact markers
        while (impactGroup.children.length > 0) {
            const obj = impactGroup.children[0];
            impactGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        }

        let totalVel = 0;
        state.meteors3DData.forEach((m) => {
            totalVel += (m.vgeo || 40);
            const meteor = new RealisticMeteor(m);
            state.activeMeteors.push(meteor);

            // Add real observation atmospheric entry markers on Earth if coordinates exist
            if (m.lat_beg != null && m.lon_beg != null) {
                const impactPos = geoToVector3(m.lat_beg, m.lon_beg, earthRadius * 1.008);
                const ringGeo = new THREE.RingGeometry(0.015, 0.045, 16);
                const ringMat = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(m.color?.r ?? 0, m.color?.g ?? 0.9, m.color?.b ?? 1),
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.65
                });
                const ring = new THREE.Mesh(ringGeo, ringMat);
                ring.position.copy(impactPos);
                ring.lookAt(0, 0, 0);
                ring.userData = m;
                impactGroup.add(ring);
            }
        });

        // Update HUD Telemetry
        const activeCount = document.getElementById('active-count');
        const avgVel = document.getElementById('hud-entry-vel');
        if (activeCount) activeCount.textContent = state.meteors3DData.length;
        if (avgVel && state.meteors3DData.length > 0) {
            avgVel.textContent = `${(totalVel / state.meteors3DData.length).toFixed(1)} km/s`;
        }

    } catch (e) {
        console.error('Error fetching 3D data:', e);
    }
}

// Continuous Spawn waves of meteors
let spawnTimer = 0;
function manageMeteorWaves(delta, effectiveSpeed) {
    spawnTimer += delta * effectiveSpeed;
    if (spawnTimer > 0.12) {
        spawnTimer = 0;
        // Find inactive meteors and launch them
        const inactive = state.activeMeteors.filter(m => !m.active);
        const batchSize = Math.min(3, inactive.length);
        for (let i = 0; i < batchSize; i++) {
            inactive[i].reset();
        }
    }

    state.activeMeteors.forEach(m => m.update(effectiveSpeed));
}

// ==========================================================================
// ANIMATION LOOP
// ==========================================================================
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

        // Smooth Earth Planetary Rotation
        if (earthMesh) earthMesh.rotation.y += 0.0018 * effectiveSpeed;
        if (gridMesh) gridMesh.rotation.y += 0.0018 * effectiveSpeed;
        if (impactGroup) impactGroup.rotation.y += 0.0018 * effectiveSpeed;

        // Dynamic Cloud Layer Rotation (slight differential speed)
        if (cloudsMesh) cloudsMesh.rotation.y += 0.0024 * effectiveSpeed;

        // Subtle Starfield Drift
        if (starField) starField.rotation.y += 0.00015 * effectiveSpeed;

        // Meteor Shower Stream Simulation
        manageMeteorWaves(delta, effectiveSpeed);
    }

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// ==========================================================================
// INTERACTIVE PREDICTION CALENDAR & ML INFERENCE ENGINE
// ==========================================================================
async function renderCalendar(year = state.calendarYear, month = state.calendarMonth) {
    const grid = document.getElementById('calendar-grid');
    const display = document.getElementById('cal-month-display');
    if (!grid || !display) return;

    try {
        const res = await fetch(`/api/predict/calendar?year=${year}&month=${month}`);
        if (!res.ok) throw new Error('Failed to fetch calendar predictions');
        const data = await res.json();

        display.textContent = `${data.month_name} ${year}`;
        grid.innerHTML = '';

        // Day of week offset for the 1st of the month
        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

        // Empty padding cells
        for (let i = 0; i < firstDayOfWeek; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day empty';
            grid.appendChild(empty);
        }

        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && (today.getMonth() + 1) === month;

        // Day cells with activity dots
        data.days.forEach(dayInfo => {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            dayEl.setAttribute('data-date', dayInfo.date);

            const isToday = isCurrentMonth && today.getDate() === dayInfo.day;
            const isSelected = state.selectedDate === dayInfo.date;

            if (isToday) dayEl.classList.add('today');
            if (isSelected) dayEl.classList.add('active');

            const numSpan = document.createElement('span');
            numSpan.className = 'cal-day-num';
            numSpan.textContent = dayInfo.day;
            dayEl.appendChild(numSpan);

            // Colored activity indicator dot
            if (dayInfo.activity_level !== 'Sporadic') {
                const dot = document.createElement('div');
                dot.className = 'cal-day-dot';
                if (dayInfo.activity_level === 'High') dot.classList.add('cal-dot-high');
                else if (dayInfo.activity_level === 'Medium') dot.classList.add('cal-dot-med');
                else dot.classList.add('cal-dot-low');
                dayEl.appendChild(dot);
            }

            // Click triggers ML prediction
            dayEl.addEventListener('click', () => {
                document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('active'));
                dayEl.classList.add('active');
                state.selectedDate = dayInfo.date;
                triggerPrediction(dayInfo.date);
            });

            grid.appendChild(dayEl);
        });

    } catch (err) {
        console.error('Error rendering calendar:', err);
    }
}

// Trigger Machine Learning Prediction for Selected Date
async function triggerPrediction(dateStr) {
    try {
        const res = await fetch(`/api/predict/date?date=${dateStr}`);
        if (!res.ok) throw new Error('Prediction API failed');
        const pred = await res.json();

        // Update Prediction Panel UI
        const dateBanner = document.getElementById('pred-selected-date');
        const solLonBanner = document.getElementById('pred-sol-lon');
        const actBadge = document.getElementById('pred-activity-badge');
        const confVal = document.getElementById('pred-confidence-val');
        const confFill = document.getElementById('pred-conf-fill');
        const showerName = document.getElementById('pred-shower-name');
        const parentBody = document.getElementById('pred-parent-body');
        const radiant = document.getElementById('pred-radiant');
        const velocity = document.getElementById('pred-velocity');
        const peakMag = document.getElementById('pred-peak-mag');
        const duration = document.getElementById('pred-duration');
        const provText = document.getElementById('pred-provenance-text');
        const hudSolLon = document.getElementById('hud-sol-lon');

        if (dateBanner) dateBanner.textContent = pred.date_formatted || pred.date;
        if (solLonBanner) solLonBanner.textContent = `λ⊙ ${pred.solar_longitude}° (Day ${pred.day_of_year})`;
        if (hudSolLon) hudSolLon.textContent = `${pred.solar_longitude}°`;

        if (actBadge) {
            actBadge.textContent = `${pred.activity_level.toUpperCase()} ACTIVITY`;
            actBadge.className = 'activity-pill';
            if (pred.activity_level === 'High') actBadge.classList.add('pill-high');
            else if (pred.activity_level === 'Medium') actBadge.classList.add('pill-med');
            else if (pred.activity_level === 'Low') actBadge.classList.add('pill-low');
            else actBadge.classList.add('pill-spo');
        }

        if (confVal) confVal.textContent = pred.confidence_percentage || `${(pred.confidence * 100).toFixed(1)}%`;
        if (confFill) confFill.style.width = `${Math.min(100, (pred.confidence || 0.9) * 100)}%`;

        if (showerName) showerName.textContent = `${pred.predicted_shower} (${pred.iau_code})`;
        if (parentBody) parentBody.textContent = pred.parent_body || 'Interplanetary Medium';
        if (radiant && pred.radiant) radiant.textContent = `RA ${pred.radiant.ra}° / DEC ${pred.radiant.dec > 0 ? '+' : ''}${pred.radiant.dec}°`;
        if (velocity) velocity.textContent = `${pred.velocity_km_s} km/s`;
        if (peakMag) peakMag.textContent = `${pred.predicted_peak_mag} mag`;
        if (duration) duration.textContent = `${pred.predicted_duration_s}s`;
        if (provText) provText.textContent = pred.dataset_source;

        // Update Observatory status pill
        const obsTitle = document.getElementById('active-stream-title');
        const obsTier = document.getElementById('active-stream-tier');
        const obsZhr = document.getElementById('active-stream-zhr');

        if (obsTitle) obsTitle.textContent = `ACTIVE STREAM: ${pred.predicted_shower.toUpperCase()}`;
        if (obsTier) {
            obsTier.textContent = `${pred.activity_level.toUpperCase()} ACTIVITY`;
            obsTier.className = `tier-badge badge-${pred.activity_level.toLowerCase().substring(0, 3)}`;
        }
        if (obsZhr) obsZhr.textContent = `~${pred.zhr_estimate || 15} ZHR`;

        // Update 3D meteor simulation stream
        if (pred.iau_code && pred.iau_code !== 'SPO') {
            state.activeStreamFilter = pred.iau_code;
            const quickSelect = document.getElementById('stream-quick-select');
            if (quickSelect) quickSelect.value = pred.iau_code;
        }

    } catch (err) {
        console.error('Error triggering prediction:', err);
    }
}

// ==========================================================================
// DATA FETCHING & EVENT LISTENERS
// ==========================================================================
async function loadInitialData() {
    try {
        const [statsRes, modelRes] = await Promise.all([
            fetch('/api/statistics').then(r => r.json()).catch(() => null),
            fetch('/api/model-info').then(r => r.json()).catch(() => null)
        ]);

        state.stats = statsRes;
        state.modelInfo = modelRes;

        // Render Calendar for initial date (January 2025 Quadrantids peak)
        await renderCalendar(state.calendarYear, state.calendarMonth);
        await triggerPrediction(state.selectedDate);
        await load3DData(state.activeStreamFilter);

    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

function setupEventListeners() {
    // Calendar Navigation
    const btnPrev = document.getElementById('cal-prev');
    const btnNext = document.getElementById('cal-next');
    const btnToday = document.getElementById('cal-today');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            state.calendarMonth--;
            if (state.calendarMonth < 1) {
                state.calendarMonth = 12;
                state.calendarYear--;
            }
            renderCalendar(state.calendarYear, state.calendarMonth);
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            state.calendarMonth++;
            if (state.calendarMonth > 12) {
                state.calendarMonth = 1;
                state.calendarYear++;
            }
            renderCalendar(state.calendarYear, state.calendarMonth);
        });
    }

    if (btnToday) {
        btnToday.addEventListener('click', () => {
            const now = new Date();
            state.calendarYear = now.getFullYear();
            state.calendarMonth = now.getMonth() + 1;
            const todayStr = `${state.calendarYear}-${String(state.calendarMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            state.selectedDate = todayStr;
            renderCalendar(state.calendarYear, state.calendarMonth);
            triggerPrediction(todayStr);
        });
    }

    // Stream Selector
    const streamSelect = document.getElementById('stream-quick-select');
    if (streamSelect) {
        streamSelect.addEventListener('change', (e) => {
            state.activeStreamFilter = e.target.value;
            load3DData(state.activeStreamFilter);
        });
    }

    // Camera Quick Views
    document.getElementById('cam-earth')?.addEventListener('click', () => {
        setCameraPosition(0, 2.5, 7.2);
    });
    document.getElementById('cam-radiant')?.addEventListener('click', () => {
        setCameraPosition(6.0, 4.0, 5.0);
    });
    document.getElementById('cam-pole')?.addEventListener('click', () => {
        setCameraPosition(0, 8.5, 1.0);
    });

    // 3D Controls Bar
    document.getElementById('toggle-animation')?.addEventListener('click', (e) => {
        state.animationRunning = !state.animationRunning;
        e.target.textContent = state.animationRunning ? '⏸️' : '▶️';
    });

    document.getElementById('toggle-earth')?.addEventListener('click', (e) => {
        state.showEarth = !state.showEarth;
        if (earthMesh) earthMesh.visible = state.showEarth;
        e.target.classList.toggle('active', state.showEarth);
    });

    document.getElementById('toggle-grid')?.addEventListener('click', (e) => {
        state.showGrid = !state.showGrid;
        if (gridMesh) gridMesh.visible = state.showGrid;
        e.target.classList.toggle('active', state.showGrid);
    });

    document.getElementById('toggle-clouds')?.addEventListener('click', (e) => {
        state.showClouds = !state.showClouds;
        if (cloudsMesh) cloudsMesh.visible = state.showClouds;
        e.target.classList.toggle('active', state.showClouds);
    });

    document.getElementById('toggle-atmos')?.addEventListener('click', (e) => {
        state.showAtmos = !state.showAtmos;
        if (atmosMesh) atmosMesh.visible = state.showAtmos;
        e.target.classList.toggle('active', state.showAtmos);
    });

    document.getElementById('toggle-trails')?.addEventListener('click', (e) => {
        state.showTrails = !state.showTrails;
        e.target.classList.toggle('active', state.showTrails);
    });

    document.getElementById('toggle-stars')?.addEventListener('click', (e) => {
        state.showStars = !state.showStars;
        if (starField) starField.visible = state.showStars;
        e.target.classList.toggle('active', state.showStars);
    });

    document.getElementById('reset-camera')?.addEventListener('click', () => {
        setCameraPosition(0, 2.5, 7.2);
        controls.target.set(0, 0, 0);
    });

    // Speed Slider
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            state.speedMultiplier = parseFloat(e.target.value);
            if (speedVal) speedVal.textContent = `${state.speedMultiplier.toFixed(1)}x`;
        });
    }

    // Density toggle
    const densityBtn = document.getElementById('density-btn');
    const densityVal = document.getElementById('density-val');
    if (densityBtn) {
        densityBtn.addEventListener('click', () => {
            const tiers = [100, 300, 500];
            const idx = (tiers.indexOf(state.densityLimit) + 1) % tiers.length;
            state.densityLimit = tiers[idx];
            if (densityVal) densityVal.textContent = state.densityLimit;
            load3DData(state.activeStreamFilter);
        });
    }

    // Focus Stream in 3D Button
    document.getElementById('btn-focus-stream')?.addEventListener('click', () => {
        load3DData(state.activeStreamFilter);
        setCameraPosition(4.5, 3.0, 6.0);
    });

    // Predictor Lab Form
    setupPredictorLab();

    // Data Explorer Table
    setupDataExplorer();

    // Modal close
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('modal')?.classList.add('hidden');
        });
    });
}

function setCameraPosition(x, y, z) {
    if (!camera) return;
    camera.position.set(x, y, z);
    if (controls) controls.update();
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
    const intersects = raycaster.intersectObjects([...meteorGroup.children, ...impactGroup.children]);

    const tooltip = document.getElementById('meteor-tooltip');
    if (intersects.length > 0) {
        const item = intersects[0].object.userData;
        if (item && tooltip) {
            document.getElementById('tip-id').textContent = item.id || 'Meteor ID';
            document.getElementById('tip-shower').textContent = `${item.shower || 'Sporadic'} (${item.iau_code || 'SPO'})`;
            document.getElementById('tip-vel').textContent = item.vgeo != null ? `${item.vgeo.toFixed(1)} km/s` : '-';
            document.getElementById('tip-peak').textContent = item.peak != null ? `${item.peak.toFixed(1)} mag` : '-';
            document.getElementById('tip-dur').textContent = item.duration != null ? `${item.duration.toFixed(2)}s` : '-';
            document.getElementById('tip-loc').textContent = item.lat_beg != null ? `${item.lat_beg.toFixed(1)}°, ${item.lon_beg?.toFixed(1)}°` : 'Space Orbit';
            document.getElementById('tip-alt').textContent = item.ht_beg != null ? `${item.ht_beg.toFixed(1)} km` : '100 km';
            tooltip.classList.remove('hidden');
        }
    } else if (tooltip) {
        tooltip.classList.add('hidden');
    }
}

// ==========================================================================
// DASHBOARD RENDERING
// ==========================================================================
function renderDashboard() {
    if (!state.stats) return;

    // Metrics
    document.getElementById('metric-total').textContent = state.stats.total_meteors?.toLocaleString() || '4,733';
    document.getElementById('metric-known').textContent = state.stats.known_showers?.toLocaleString() || '1,069';
    document.getElementById('metric-sporadic').textContent = state.stats.sporadic?.toLocaleString() || '3,664';
    document.getElementById('metric-unique').textContent = state.stats.unique_showers || '32';
    document.getElementById('metric-vel').textContent = `${(state.stats.avg_velocity || 40.3).toFixed(1)} km/s`;
    document.getElementById('metric-peak').textContent = `${(state.stats.avg_peak || 0.04).toFixed(2)} mag`;

    // Major Showers Carousel
    const carousel = document.getElementById('major-showers-list');
    if (carousel) {
        carousel.innerHTML = MAJOR_SHOWERS_CATALOG.map(s => `
            <div class="shower-card-item" onclick="window.focusShower('${s.code}')">
                <div class="sc-header">
                    <span class="sc-code">${s.code}</span>
                    <span class="tier-badge badge-${s.tier.toLowerCase().substring(0, 3)}">${s.tier}</span>
                </div>
                <div class="sc-name">${s.name}</div>
                <div class="sc-dates">Peak: ${s.peak} (${s.dates})</div>
                <div class="sc-meta">
                    <span>${s.vel} km/s</span>
                    <span>~${s.zhr} ZHR</span>
                    <span>RA ${s.ra}°</span>
                </div>
            </div>
        `).join('');
    }

    // Top Showers in Dataset
    const topList = document.getElementById('top-showers-list');
    if (topList && state.stats.top_showers) {
        topList.innerHTML = state.stats.top_showers.slice(0, 8).map(s => `
            <div class="shower-item" style="display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.02); margin-bottom: 6px; border-radius: 6px;">
                <span style="font-weight: 600; color: #fff;">${s.name}</span>
                <span style="color: var(--accent); font-family: var(--font-heading);">${s.count} events</span>
            </div>
        `).join('');
    }

    // Activity distribution
    const distWrap = document.getElementById('activity-dist-wrap');
    if (distWrap && state.stats.activity_distribution) {
        const dist = state.stats.activity_distribution;
        const total = state.stats.total_meteors || 4733;
        const items = [
            { label: 'High (Major Showers)', count: dist.High || 470, color: '#f43f5e' },
            { label: 'Medium (Cataloged Streams)', count: dist.Medium || 599, color: '#fbbf24' },
            { label: 'Low (Minor Streams)', count: dist.Low || 1116, color: '#38bdf8' },
            { label: 'Sporadic Background', count: dist.Sporadic || 2548, color: '#64748b' }
        ];

        distWrap.innerHTML = items.map(it => `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px;">
                    <span style="color: #fff;">${it.label}</span>
                    <span style="color: ${it.color}; font-weight: 700;">${it.count} (${((it.count/total)*100).toFixed(1)}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                    <div style="width: ${(it.count/total)*100}%; height: 100%; background: ${it.color};"></div>
                </div>
            </div>
        `).join('');
    }
}

window.focusShower = (code) => {
    state.activeStreamFilter = code;
    switchView('3d');
    const select = document.getElementById('stream-quick-select');
    if (select) select.value = code;
    load3DData(code);
};

// ==========================================================================
// AI MODEL & EVALUATION VIEW RENDERING
// ==========================================================================
function renderModelView() {
    if (!state.modelInfo) return;

    const m = state.modelInfo;
    document.getElementById('ai-accuracy').textContent = `${(m.accuracy * 100).toFixed(2)}%`;
    document.getElementById('ai-f1').textContent = `${(m.weighted_f1 * 100).toFixed(2)}%`;
    document.getElementById('ai-precision').textContent = `${(m.weighted_precision * 100).toFixed(2)}%`;
    document.getElementById('ai-recall').textContent = `${(m.weighted_recall * 100).toFixed(2)}%`;

    // Per-class Table
    const tbody = document.getElementById('per-class-tbody');
    if (tbody && m.per_class) {
        tbody.innerHTML = Object.entries(m.per_class).map(([className, met]) => `
            <tr>
                <td><strong>${className}</strong></td>
                <td>${(met.precision * 100).toFixed(1)}%</td>
                <td>${(met.recall * 100).toFixed(1)}%</td>
                <td>${(met.f1 * 100).toFixed(1)}%</td>
                <td>${met.support} samples</td>
            </tr>
        `).join('');
    }

    // Feature Importances
    const featList = document.getElementById('feature-importances-list');
    if (featList && m.feature_importances) {
        const maxImp = m.feature_importances[0]?.importance || 0.3;
        featList.innerHTML = m.feature_importances.map(f => `
            <div class="feature-row">
                <div class="feat-meta">
                    <span class="feat-name">${f.feature}</span>
                    <span class="feat-val">${(f.importance * 100).toFixed(1)}%</span>
                </div>
                <div class="feat-bar">
                    <div class="feat-fill" style="width: ${(f.importance / maxImp) * 100}%;"></div>
                </div>
            </div>
        `).join('');
    }

    // Confusion Matrix Table
    const matrixCont = document.getElementById('matrix-container');
    if (matrixCont && m.confusion_matrix && m.classes) {
        const cm = m.confusion_matrix;
        const classes = m.classes;

        let tableHtml = '<table class="matrix-table"><thead><tr><th>Actual \\ Pred</th>';
        classes.forEach(c => { tableHtml += `<th>${c}</th>`; });
        tableHtml += '</tr></thead><tbody>';

        cm.forEach((row, rIdx) => {
            tableHtml += `<tr><th>${classes[rIdx]}</th>`;
            row.forEach((val, cIdx) => {
                const isDiag = rIdx === cIdx;
                const bg = isDiag ? 'rgba(0, 240, 255, 0.25)' : (val > 0 ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.03)');
                const color = isDiag ? '#00f0ff' : (val > 0 ? '#f43f5e' : '#64748b');
                tableHtml += `<td style="background: ${bg}; color: ${color};">${val}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        matrixCont.innerHTML = tableHtml;
    }
}

// ==========================================================================
// PREDICTOR LAB LOGIC
// ==========================================================================
function setupPredictorLab() {
    document.getElementById('btn-preset-qua')?.addEventListener('click', () => {
        document.getElementById('f-sol-lon').value = 283.4;
        document.getElementById('f-rageo').value = 230.1;
        document.getElementById('f-decgeo').value = 49.5;
        document.getElementById('f-vgeo').value = 41.2;
        document.getElementById('f-a').value = 3.12;
        document.getElementById('f-e').value = 0.68;
        document.getElementById('f-i').value = 71.4;
        document.getElementById('f-dur').value = 0.54;
        document.getElementById('f-peak').value = -0.3;
    });

    document.getElementById('btn-preset-per')?.addEventListener('click', () => {
        document.getElementById('f-sol-lon').value = 140.0;
        document.getElementById('f-rageo').value = 48.2;
        document.getElementById('f-decgeo').value = 58.1;
        document.getElementById('f-vgeo').value = 59.0;
        document.getElementById('f-a').value = 28.0;
        document.getElementById('f-e').value = 0.96;
        document.getElementById('f-i').value = 113.4;
        document.getElementById('f-dur').value = 0.45;
        document.getElementById('f-peak').value = -1.2;
    });

    document.getElementById('btn-predict')?.addEventListener('click', async () => {
        const payload = {
            Sol_lon: parseFloat(document.getElementById('f-sol-lon').value),
            RAgeo: parseFloat(document.getElementById('f-rageo').value),
            DECgeo: parseFloat(document.getElementById('f-decgeo').value),
            Vgeo: parseFloat(document.getElementById('f-vgeo').value),
            Mass_kg: parseFloat(document.getElementById('f-mass').value),
            Duration: parseFloat(document.getElementById('f-dur').value),
            Peak: parseFloat(document.getElementById('f-peak').value),
            a: parseFloat(document.getElementById('f-a').value),
            e: parseFloat(document.getElementById('f-e').value),
            i: parseFloat(document.getElementById('f-i').value),
            TisserandJ: parseFloat(document.getElementById('f-tiss').value)
        };

        const resContent = document.getElementById('res-content');
        const resPlaceholder = document.getElementById('res-placeholder');
        const spinner = document.getElementById('predict-spinner');

        if (spinner) spinner.classList.remove('hidden');

        try {
            const res = await fetch('/api/predict/comprehensive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const out = await res.json();

            if (resPlaceholder) resPlaceholder.classList.add('hidden');
            if (resContent) {
                resContent.classList.remove('hidden');
                resContent.innerHTML = `
                    <div class="result-box" style="display: flex; flex-direction: column; gap: 14px;">
                        <div style="background: rgba(0,240,255,0.08); padding: 12px; border-radius: 8px; border-left: 3px solid var(--accent);">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">PREDICTED SHOWER STREAM</span>
                            <h3 style="font-family: var(--font-heading); color: #fff; margin: 4px 0;">${out.shower_prediction.predicted_shower}</h3>
                            <span style="font-size: 0.8rem; color: var(--accent);">Random Forest Confidence: ${(out.shower_prediction.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Peak Magnitude</span>
                                <strong style="color: #fff; font-size: 1.1rem;">${out.peak_magnitude.value.toFixed(2)}</strong>
                                <span style="font-size: 0.72rem; color: var(--accent); display: block;">${out.peak_magnitude.intensity_class}</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Predicted Duration</span>
                                <strong style="color: #fff; font-size: 1.1rem;">${out.duration.formatted}</strong>
                                <span style="font-size: 0.72rem; color: var(--accent); display: block;">${out.duration.class} Track</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Kinetic Energy (J)</span>
                                <strong style="color: #fff; font-size: 0.95rem;">${out.estimated_energy_joules.toExponential(2)} J</strong>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">Risk Level</span>
                                <strong style="color: #fbbf24; font-size: 1rem;">${out.risk_assessment.level}</strong>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            console.error('Error running inference:', err);
        } finally {
            if (spinner) spinner.classList.add('hidden');
        }
    });
}

// ==========================================================================
// DATA EXPLORER TABLE & DETAILS MODAL
// ==========================================================================
function setupDataExplorer() {
    const searchInput = document.getElementById('search-input');
    const showerFilter = document.getElementById('data-shower-filter');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    // Populate shower filter
    if (showerFilter && state.stats?.top_showers) {
        state.stats.top_showers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = `${s.name} (${s.count} events)`;
            showerFilter.appendChild(opt);
        });
    }

    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                state.searchQuery = e.target.value;
                state.page = 1;
                fetchMeteorTableData();
            }, 300);
        });
    }

    if (showerFilter) {
        showerFilter.addEventListener('change', (e) => {
            state.dataShowerFilter = e.target.value;
            state.page = 1;
            fetchMeteorTableData();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (state.page > 1) {
                state.page--;
                fetchMeteorTableData();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            state.page++;
            fetchMeteorTableData();
        });
    }
}

async function fetchMeteorTableData() {
    const tbody = document.querySelector('#meteor-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">Loading dataset from Python backend...</td></tr>';

    try {
        const url = `/api/meteors?page=${state.page}&per_page=${state.perPage}&search=${encodeURIComponent(state.searchQuery)}&shower=${encodeURIComponent(state.dataShowerFilter)}`;
        const res = await fetch(url);
        const data = await res.json();

        const total = data.total || 0;
        const pageNumber = document.getElementById('page-number');
        const pageInfo = document.getElementById('page-info');

        if (pageNumber) pageNumber.textContent = `Page ${state.page}`;
        if (pageInfo) pageInfo.textContent = `Showing ${(state.page - 1) * state.perPage + 1}-${Math.min(state.page * state.perPage, total)} of ${total}`;

        if (data.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 25px; color: var(--text-muted);">No matching meteor records found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.data.map(m => `
            <tr>
                <td style="font-family: var(--font-heading); color: var(--accent);">${m.id}</td>
                <td><strong style="color: #fff;">${m.iau_shower}</strong> (${m.iau_code})</td>
                <td><span class="tier-badge badge-${(m.activity || 'spo').toLowerCase().substring(0, 3)}">${m.activity || 'Sporadic'}</span></td>
                <td>${m.sol_lon ? m.sol_lon.toFixed(2) + '°' : '-'}</td>
                <td>${m.rageo ? `${m.rageo.toFixed(1)}° / ${m.decgeo?.toFixed(1)}°` : '-'}</td>
                <td>${m.vgeo ? m.vgeo.toFixed(1) + ' km/s' : '-'}</td>
                <td>${m.peak != null ? m.peak.toFixed(2) : '-'}</td>
                <td>${m.duration != null ? m.duration.toFixed(2) + 's' : '-'}</td>
                <td>${m.lat_beg != null ? `${m.lat_beg.toFixed(1)}°, ${m.lon_beg?.toFixed(1)}°` : '-'}</td>
                <td>
                    <button class="btn btn-small" onclick="window.inspectMeteor('${m.id}')">Inspect</button>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error('Error fetching table data:', err);
    }
}

window.inspectMeteor = async (id) => {
    try {
        const res = await fetch(`/api/meteors/${encodeURIComponent(id)}`);
        const item = await res.json();
        const modal = document.getElementById('modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        if (!modal || !body) return;

        title.textContent = `Trajectory Inspection: ${item['Unique trajectory'] || id}`;

        const keys = ['IAU_Shower', 'IAU_Code', 'Sol_lon', 'RAgeo', 'DECgeo', 'Vgeo', 'Peak', 'Duration', 'Mass_kg', 'LatBeg', 'LonBeg', 'HtBeg', 'LatEnd', 'LonEnd', 'HtEnd', 'a', 'e', 'i', 'TisserandJ'];
        
        body.innerHTML = `
            <div class="detail-grid">
                ${keys.map(k => `
                    <div class="detail-item">
                        <div class="detail-label">${k}</div>
                        <div class="detail-val">${item[k] !== null && item[k] !== undefined ? item[k] : 'N/A'}</div>
                    </div>
                `).join('')}
            </div>
        `;

        modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error inspecting meteor:', err);
    }
};
