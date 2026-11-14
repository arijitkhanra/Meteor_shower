import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================================================
// METEOR SHOWER – AI-POWERED METEOR SHOWER PREDICTION SYSTEM
// OBSERVATORY APPLICATION STATE
// ==========================================================================
const now = new Date();
const state = {
    currentView: '3d',
    stats: null,
    modelInfo: null,
    meteors3DData: [],
    activeMeteors: [],
    animationRunning: true,
    speedMultiplier: 1.0,
    earthSpinRate: 1.0,               // Earth spin speed (-3.0x to +3.0x)
    earthSpinPaused: false,
    streamDirectionMode: 'radiant',    // 'radiant', 'north', 'south', 'west', 'east', 'custom', 'omni'
    customStreamAzimuth: 45,           // 0 to 360 degrees
    densityLimit: 120,                // Meteor pool size: 50, 80, 120, 200, 300
    showEarth: true,
    showClouds: true,
    showAtmos: true,
    showMeteors: true,
    activeStreamFilter: 'QUA',
    selectedDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
    calendarYear: now.getFullYear(),
    calendarMonth: now.getMonth() + 1,
    page: 1,
    perPage: 50,
    searchQuery: '',
    dataShowerFilter: '',
    totalRecords: 4733
};

// ==========================================================================
// THREE.JS SCENE GLOBALS & SMOOTH CAMERA TRANSITIONS
// ==========================================================================
let scene, camera, renderer, controls;
let earthGroup, earthMesh, cloudsMesh, atmosMesh;
let starField, meteorGroup, trailGroup;
let raycaster, mouse;
let clock = new THREE.Clock();
let fpsFrames = 0, fpsTime = 0;
const earthRadius = 2.25;

// Camera Smooth Transition Engine
let cameraTransition = {
    active: false,
    startTime: 0,
    duration: 800,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3()
};

// ==========================================================================
// IAU & ASTRONOMICAL METEOR SHOWER ALMANAC CATALOG
// ==========================================================================
const MAJOR_SHOWERS_CATALOG = [
    { code: 'QUA', name: 'Quadrantids', parent: 'Asteroid 2003 EH1', dates: 'Jan 01 - Jan 05', peak: 'Jan 03-04', zhr: 110, ra: 230.1, dec: 49.5, vel: 41.2, sol_lon: 283.4, peak_mag: -0.32, tier: 'High', color: '#00f0ff' },
    { code: 'LYR', name: 'Lyrids', parent: 'Comet Thatcher (C/1861 G1)', dates: 'Apr 16 - Apr 25', peak: 'Apr 22', zhr: 18, ra: 271.4, dec: 33.6, vel: 46.8, sol_lon: 32.3, peak_mag: 0.15, tier: 'Medium', color: '#2dd4bf' },
    { code: 'ETA', name: 'eta Aquariids', parent: 'Comet 1P/Halley', dates: 'Apr 19 - May 28', peak: 'May 06', zhr: 50, ra: 338.0, dec: -1.0, vel: 66.0, sol_lon: 45.5, peak_mag: 0.05, tier: 'Medium', color: '#34d399' },
    { code: 'SDA', name: 'Southern delta Aquariids', parent: 'Comet 96P/Machholz', dates: 'Jul 12 - Aug 23', peak: 'Jul 30', zhr: 25, ra: 339.6, dec: -16.4, vel: 41.0, sol_lon: 126.0, peak_mag: 0.22, tier: 'Medium', color: '#fb923c' },
    { code: 'PER', name: 'Perseids', parent: 'Comet 109P/Swift-Tuttle', dates: 'Jul 17 - Aug 24', peak: 'Aug 12-13', zhr: 100, ra: 48.2, dec: 58.1, vel: 59.0, sol_lon: 140.0, peak_mag: -1.25, tier: 'High', color: '#f43f5e' },
    { code: 'ORI', name: 'Orionids', parent: 'Comet 1P/Halley', dates: 'Oct 02 - Nov 07', peak: 'Oct 21-22', zhr: 20, ra: 95.0, dec: 16.0, vel: 66.0, sol_lon: 208.5, peak_mag: -0.10, tier: 'Medium', color: '#e879f9' },
    { code: 'LEO', name: 'Leonids', parent: 'Comet 55P/Tempel-Tuttle', dates: 'Nov 06 - Nov 30', peak: 'Nov 17-18', zhr: 15, ra: 152.0, dec: 22.0, vel: 71.0, sol_lon: 235.3, peak_mag: -0.45, tier: 'Medium', color: '#facc15' },
    { code: 'GEM', name: 'Geminids', parent: 'Asteroid 3200 Phaethon', dates: 'Dec 04 - Dec 20', peak: 'Dec 13-14', zhr: 150, ra: 112.3, dec: 33.0, vel: 35.0, sol_lon: 262.2, peak_mag: -1.40, tier: 'High', color: '#fbbf24' },
    { code: 'URS', name: 'Ursids', parent: 'Comet 8P/Tuttle', dates: 'Dec 17 - Dec 26', peak: 'Dec 22-23', zhr: 10, ra: 217.0, dec: 76.0, vel: 33.0, sol_lon: 270.8, peak_mag: 0.42, tier: 'Low', color: '#38bdf8' },
    { code: 'COM', name: 'Comae Berenicids', parent: 'Unknown Periodic Comet', dates: 'Dec 12 - Jan 23', peak: 'Dec 16 & Jan 02', zhr: 5, ra: 173.3, dec: 24.7, vel: 62.3, sol_lon: 281.4, peak_mag: 0.35, tier: 'Medium', color: '#38bdf8' },
    { code: 'AHY', name: 'alpha Hydrids', parent: 'Unknown Cometary Fragment', dates: 'Jan 01 - Jan 08', peak: 'Jan 05', zhr: 4, ra: 126.8, dec: 2.7, vel: 44.1, sol_lon: 285.0, peak_mag: 0.60, tier: 'Low', color: '#a855f7' },
    { code: 'NCC', name: 'Northern chi Orionids', parent: 'Asteroid 1999 YD', dates: 'Nov 25 - Dec 31', peak: 'Dec 10', zhr: 3, ra: 83.2, dec: 24.2, vel: 29.8, sol_lon: 258.0, peak_mag: 0.80, tier: 'Low', color: '#60a5fa' },
    { code: 'SCC', name: 'Southern chi Orionids', parent: 'Unknown Asteroid', dates: 'Nov 25 - Dec 31', peak: 'Dec 11', zhr: 3, ra: 81.8, dec: 15.6, vel: 27.5, sol_lon: 259.0, peak_mag: 0.95, tier: 'Low', color: '#fb923c' }
];

function getCatalogShower(code) {
    if (!code) return MAJOR_SHOWERS_CATALOG[0];
    const upper = code.toUpperCase();
    return MAJOR_SHOWERS_CATALOG.find(s => s.code === upper || s.name.toUpperCase().includes(upper)) || {
        code: code,
        name: code,
        parent: 'Interplanetary Debris Stream',
        dates: 'Annual Activity Window',
        peak: 'Peak Period',
        zhr: 15,
        ra: 230.1,
        dec: 49.5,
        vel: 41.2,
        sol_lon: 283.4,
        peak_mag: 0.1,
        tier: 'Medium',
        color: '#00f0ff'
    };
}

function getCompassHeading(deg) {
    const headings = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    const idx = Math.round((deg % 360) / 45);
    return headings[idx];
}

// ==========================================================================
// INITIALIZATION LIFECYCLE
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
        }, 450);
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
        setTimeout(onWindowResize, 60);
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
    scene.fog = new THREE.FogExp2(0x02040a, 0.008);

    const width = container.clientWidth || (window.innerWidth * 0.58);
    const height = container.clientHeight || (window.innerHeight - 65);

    // Exact 1:1:1 aspect ratio camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.8, 6.6);

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Orbit Controls with Smooth Damping and Safe Zoom Limits
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2.75;  // Earth radius is 2.25: permits surface close-ups without clipping inside
    controls.maxDistance = 15.0;  // Deep space view
    controls.zoomSpeed = 1.0;
    controls.rotateSpeed = 0.8;
    controls.target.set(0, 0, 0);

    // Natural Planetary Lighting
    const ambientLight = new THREE.AmbientLight(0x223355, 1.8);
    scene.add(ambientLight);

    // Sun Directional Light (Illuminates day hemisphere with natural terminator)
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 3.2);
    sunLight.position.set(16, 7, 12);
    scene.add(sunLight);

    // Soft Atmospheric Fill Light (Backlit spaceglow)
    const rimLight = new THREE.DirectionalLight(0x00d4e5, 0.7);
    rimLight.position.set(-14, -5, -8);
    scene.add(rimLight);

    // Scene Groups: Earth and Falling Meteors only (No extra clutter/rings)
    earthGroup = new THREE.Group();
    meteorGroup = new THREE.Group();
    trailGroup = new THREE.Group();

    scene.add(earthGroup);
    scene.add(meteorGroup);
    scene.add(trailGroup);

    // Build Astronomical Components
    createCleanStarfield();
    createNoiseFreeRealisticEarth();

    // Raycasting for interactive telemetry tooltips
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
}

// ==========================================================================
// NOISE-FREE PHOTOREALISTIC 3D EARTH (CLEAR & CRISP, ZERO NOISE)
// ==========================================================================
function createNoiseFreeRealisticEarth() {
    const texLoader = new THREE.TextureLoader();

    // Load High-Resolution NASA Satellite Textures
    const dayTex = texLoader.load('assets/textures/earth_day.jpg');
    dayTex.colorSpace = THREE.SRGBColorSpace;
    dayTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const normalTex = texLoader.load('assets/textures/earth_normal.jpg');
    normalTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const specularTex = texLoader.load('assets/textures/earth_specular.jpg');
    specularTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // 1. Earth Surface Sphere (Radius = 2.25, 64x64 segments)
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
        map: dayTex,
        normalMap: normalTex,
        normalScale: new THREE.Vector2(0.65, 0.65),
        specularMap: specularTex,
        specular: new THREE.Color(0x285070),
        shininess: 30
    });

    earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 2. Realistic Soft Swirling Clouds Layer
    const cloudsTex = texLoader.load('assets/textures/earth_clouds_rgba.png');
    cloudsTex.colorSpace = THREE.SRGBColorSpace;
    cloudsTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const cloudsGeo = new THREE.SphereGeometry(earthRadius * 1.015, 64, 64);
    const cloudsMat = new THREE.MeshPhongMaterial({
        map: cloudsTex,
        transparent: true,
        opacity: 0.48,
        blending: THREE.NormalBlending,
        depthWrite: false
    });
    cloudsMesh = new THREE.Mesh(cloudsGeo, cloudsMat);
    earthGroup.add(cloudsMesh);

    // 3. Rayleigh Atmospheric Scattering Glow Halo (Soft horizon rim glow)
    const atmosGeo = new THREE.SphereGeometry(earthRadius * 1.038, 64, 64);
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
                gl_FragColor = vec4(0.05, 0.75, 1.0, 1.0) * intensity * 0.95;
            }
        `,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });
    atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    earthGroup.add(atmosMesh);

    // Astronomical axial tilt (23.44°)
    earthGroup.rotation.z = THREE.MathUtils.degToRad(23.44);
}

// Deep Space Starfield (Pristine, soft, noise-free)
function createCleanStarfield() {
    const starCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        const radius = 65 + Math.random() * 85;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);

        positions[i] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = radius * Math.cos(phi);

        const tint = Math.random();
        if (tint > 0.8) {
            colors[i] = 0.6; colors[i + 1] = 0.85; colors[i + 2] = 1.0;
        } else if (tint > 0.6) {
            colors[i] = 1.0; colors[i + 1] = 0.88; colors[i + 2] = 0.65;
        } else {
            colors[i] = 0.95; colors[i + 1] = 0.95; colors[i + 2] = 1.0;
        }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.15,
        vertexColors: true,
        transparent: true,
        opacity: 0.75
    });

    starField = new THREE.Points(geometry, material);
    scene.add(starField);
}

// Radiant Coordinates (RA, DEC) to Direction Vector in Space
function radiantToDirectionVector(ra, dec) {
    const raRad = THREE.MathUtils.degToRad(ra);
    const decRad = THREE.MathUtils.degToRad(dec);

    const x = Math.cos(decRad) * Math.cos(raRad);
    const y = Math.sin(decRad);
    const z = Math.cos(decRad) * Math.sin(raRad);

    return new THREE.Vector3(x, y, z).normalize();
}

// ==========================================================================
// REALISTIC FALLING METEORS (ONLY METEORS FALLING DIRECTLY TOWARDS EARTH)
// ==========================================================================
class RealisticMeteor {
    constructor(data, isSporadic = false) {
        this.data = data;
        this.isSporadic = isSporadic;
        this.active = false;
        this.progress = 0;
        this.trailLength = 22;

        // Visual Head: bright luminous particle
        const size = Math.max(0.045, Math.min(0.085, (data.size || 0.05) * 1.15));
        const headGeo = new THREE.SphereGeometry(size, 8, 8);
        const col = new THREE.Color(
            data.color?.r ?? (isSporadic ? 1.0 : 0.2),
            data.color?.g ?? (isSporadic ? 0.85 : 0.95),
            data.color?.b ?? (isSporadic ? 0.4 : 1.0)
        );
        this.baseColor = col;
        const headMat = new THREE.MeshBasicMaterial({ color: col });
        this.headMesh = new THREE.Mesh(headGeo, headMat);
        this.headMesh.userData = data;

        // Trail Line Geometry
        this.trailPositions = new Float32Array(this.trailLength * 3);
        this.trailColors = new Float32Array(this.trailLength * 3);

        const trailGeo = new THREE.BufferGeometry();
        trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));

        const trailMat = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending
        });

        this.trailLine = new THREE.Line(trailGeo, trailMat);

        meteorGroup.add(this.headMesh);
        trailGroup.add(this.trailLine);

        this.currentPos = new THREE.Vector3();
        this.history = [];
        this.reset();
    }

    reset() {
        this.progress = 0;
        this.active = true;
        this.history = [];

        // Speed scaled to physical entry velocity (km/s)
        const velKmS = this.data.vgeo || 41.2;
        this.speed = (0.010 + (velKmS / 72.0) * 0.016);

        // 1. Determine Falling Direction Vector
        let fallDir;
        if (state.streamDirectionMode === 'north') {
            fallDir = new THREE.Vector3(0.02, -1.0, 0.02).normalize();
        } else if (state.streamDirectionMode === 'south') {
            fallDir = new THREE.Vector3(0.02, 1.0, 0.02).normalize();
        } else if (state.streamDirectionMode === 'west') {
            fallDir = new THREE.Vector3(1.0, -0.35, 0.1).normalize();
        } else if (state.streamDirectionMode === 'east') {
            fallDir = new THREE.Vector3(-1.0, -0.35, 0.1).normalize();
        } else if (state.streamDirectionMode === 'custom') {
            const azRad = THREE.MathUtils.degToRad(state.customStreamAzimuth);
            fallDir = new THREE.Vector3(-Math.sin(azRad), -0.75, -Math.cos(azRad)).normalize();
        } else if (state.streamDirectionMode === 'omni' || this.isSporadic) {
            // Plunge in towards Earth center from random celestial sphere point
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            fallDir = new THREE.Vector3(
                -Math.sin(phi) * Math.cos(theta),
                -Math.sin(phi) * Math.sin(theta),
                -Math.cos(phi)
            ).normalize();
        } else {
            // 'radiant' (Default IAU Astronomical coordinates)
            const rVector = radiantToDirectionVector(this.data.rageo || 230.1, this.data.decgeo || 49.5);
            fallDir = rVector.clone().negate().normalize();
        }

        // 2. Build Coordinate Frame perpendicular to fall direction
        let ref = new THREE.Vector3(0, 1, 0);
        if (Math.abs(fallDir.dot(ref)) > 0.88) {
            ref.set(0, 0, 1);
        }
        const p1 = new THREE.Vector3().crossVectors(fallDir, ref).normalize();
        const p2 = new THREE.Vector3().crossVectors(fallDir, p1).normalize();

        // 3. Aim directly at Earth's atmospheric disk
        // Radius between 0.15 and 2.05 ensures every meteor hits Earth's atmosphere
        const angle = Math.random() * Math.PI * 2;
        const entryRadius = Math.sqrt(Math.random()) * 2.05;
        const offset = new THREE.Vector3()
            .addScaledVector(p1, Math.cos(angle) * entryRadius)
            .addScaledVector(p2, Math.sin(angle) * entryRadius);

        // Impact point on Earth's upper atmosphere (radius 2.27)
        const forwardDepth = Math.sqrt(Math.max(0.1, (earthRadius * 1.01) ** 2 - entryRadius ** 2));
        this.endPos = offset.clone().addScaledVector(fallDir, forwardDepth);

        // Spawn position: high up in space along the falling trajectory
        const fallDistance = 5.2 + Math.random() * 3.8;
        this.startPos = this.endPos.clone().sub(fallDir.clone().multiplyScalar(fallDistance));

        this.currentPos.copy(this.startPos);

        // Initialize trail gradient
        for (let i = 0; i < this.trailLength * 3; i += 3) {
            const ratio = 1 - (i / (this.trailLength * 3));
            this.trailColors[i] = this.baseColor.r * ratio;
            this.trailColors[i + 1] = this.baseColor.g * ratio;
            this.trailColors[i + 2] = this.baseColor.b * ratio;
        }
        this.trailLine.geometry.attributes.color.needsUpdate = true;
    }

    update(effectiveSpeed) {
        if (!this.active) return;

        this.progress += this.speed * effectiveSpeed;

        if (this.progress >= 1.0) {
            this.active = false;
            this.headMesh.visible = false;
            this.trailLine.visible = false;
            return;
        }

        this.headMesh.visible = state.showMeteors;
        this.trailLine.visible = state.showMeteors;

        this.currentPos.lerpVectors(this.startPos, this.endPos, this.progress);
        this.headMesh.position.copy(this.currentPos);

        // Atmospheric ablation flare: flares brightly when entering upper atmosphere
        const distFromCenter = this.currentPos.length();
        if (distFromCenter < earthRadius * 1.15 && distFromCenter > earthRadius * 0.99) {
            const flare = 1.0 + Math.sin(this.progress * Math.PI) * 2.2;
            this.headMesh.scale.set(flare, flare, flare);
            this.headMesh.material.color.setRGB(1.0, 0.98, 0.9); // Brilliant white-hot core
        } else if (distFromCenter <= earthRadius * 0.99) {
            // Vaporized in lower atmosphere
            this.active = false;
            this.headMesh.visible = false;
            this.trailLine.visible = false;
            return;
        } else {
            this.headMesh.scale.set(1.0, 1.0, 1.0);
            this.headMesh.material.color.copy(this.baseColor);
        }

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

// Populate 3D Simulation with Dataset Trajectories
async function load3DData(filter = state.activeStreamFilter) {
    try {
        const url = `/api/3d-data?limit=${state.densityLimit}${filter && filter !== 'ALL' ? `&shower=${filter}` : ''}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load 3D meteor telemetry');
        const data = await res.json();
        state.meteors3DData = data.meteors || [];

        // Clear existing instances
        state.activeMeteors.forEach(m => m.destroy());
        state.activeMeteors = [];

        const showerCatalogItem = getCatalogShower(filter);

        // Synthesize pool of pure falling meteors
        const totalPool = state.densityLimit;
        const sporadicCount = Math.floor(totalPool * 0.15);

        for (let i = 0; i < totalPool; i++) {
            const isSporadic = i < sporadicCount;
            const meteorData = state.meteors3DData[i % Math.max(1, state.meteors3DData.length)] || {
                id: `MTR-${1000 + i}`,
                shower: showerCatalogItem.name,
                iau_code: showerCatalogItem.code,
                vgeo: showerCatalogItem.vel,
                rageo: showerCatalogItem.ra,
                decgeo: showerCatalogItem.dec,
                peak: showerCatalogItem.peak_mag,
                duration: 0.5,
                mass: 0.0002
            };

            const meteor = new RealisticMeteor(meteorData, isSporadic);
            // Stagger initial progress so meteors are actively falling at startup
            meteor.progress = Math.random();
            state.activeMeteors.push(meteor);
        }

    } catch (e) {
        console.error('Error fetching 3D data:', e);
    }
}

let spawnTimer = 0;
function manageMeteorWaves(delta, effectiveSpeed) {
    if (!state.showMeteors) return;

    spawnTimer += delta * effectiveSpeed;
    if (spawnTimer > 0.07) {
        spawnTimer = 0;
        const inactive = state.activeMeteors.filter(m => !m.active);
        const batchSize = Math.min(3, inactive.length);
        for (let i = 0; i < batchSize; i++) {
            inactive[i].reset();
        }
    }

    state.activeMeteors.forEach(m => m.update(effectiveSpeed));
}

// Re-align all active meteor trajectories when direction mode or angle slider changes
function realignMeteorTrajectories() {
    state.activeMeteors.forEach(m => {
        m.reset();
        m.progress = Math.random();
    });
}

// ==========================================================================
// SMOOTH CAMERA TRANSITION ANIMATOR
// ==========================================================================
function animateCameraTo(targetPos, targetLookAt = new THREE.Vector3(0, 0, 0), duration = 800) {
    if (!camera || !controls) return;
    cameraTransition.active = true;
    cameraTransition.startTime = performance.now();
    cameraTransition.duration = duration;
    cameraTransition.startPos.copy(camera.position);
    cameraTransition.endPos.copy(targetPos);
    cameraTransition.startTarget.copy(controls.target);
    cameraTransition.endTarget.copy(targetLookAt);
}

function updateCameraTransition() {
    if (!cameraTransition.active) return;
    const now = performance.now();
    const elapsed = now - cameraTransition.startTime;
    const t = Math.min(1.0, elapsed / cameraTransition.duration);

    // Cubic easeInOut curve
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(cameraTransition.startPos, cameraTransition.endPos, ease);
    controls.target.lerpVectors(cameraTransition.startTarget, cameraTransition.endTarget, ease);
    controls.update();

    if (t >= 1.0) {
        cameraTransition.active = false;
    }
}

// ==========================================================================
// ANIMATION LOOP (60 FPS FLUID PLANETARY & METEOR SIMULATION)
// ==========================================================================
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    fpsFrames++;
    fpsTime += delta;
    if (fpsTime >= 1.0) {
        fpsFrames = 0;
        fpsTime = 0;
    }

    if (cameraTransition.active) {
        updateCameraTransition();
    }

    if (state.animationRunning) {
        const effectiveSpeed = state.speedMultiplier;

        // Controlled Earth Planetary Rotation (Rate & Direction)
        if (earthGroup && !state.earthSpinPaused) {
            earthGroup.rotation.y += 0.0018 * state.earthSpinRate * effectiveSpeed;
        }

        // Swirling Cloud Layer Rotation (Gentle differential speed)
        if (cloudsMesh && !state.earthSpinPaused) {
            cloudsMesh.rotation.y += 0.0024 * state.earthSpinRate * effectiveSpeed;
        }

        // Celestial Starfield Drift
        if (starField) starField.rotation.y += 0.00010 * effectiveSpeed;

        // Multi-directional Falling Meteor Simulation
        manageMeteorWaves(delta, effectiveSpeed);
    }

    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}

// ==========================================================================
// INTERACTIVE PREDICTION CALENDAR & AI INFERENCE ENGINE
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

        const firstDayOfWeek = new Date(year, month - 1, 1).getDay();

        // Padding empty cells
        for (let i = 0; i < firstDayOfWeek; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-day-box empty';
            grid.appendChild(empty);
        }

        const currentDate = new Date();
        const isCurrentMonth = currentDate.getFullYear() === year && (currentDate.getMonth() + 1) === month;

        data.days.forEach(dayInfo => {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day-box';
            dayEl.setAttribute('data-date', dayInfo.date);

            const isToday = isCurrentMonth && currentDate.getDate() === dayInfo.day;
            const isSelected = state.selectedDate === dayInfo.date;

            if (isToday) dayEl.classList.add('today');
            if (isSelected) dayEl.classList.add('active');

            const numSpan = document.createElement('span');
            numSpan.className = 'numeric';
            numSpan.textContent = dayInfo.day;
            dayEl.appendChild(numSpan);

            // Activity level indicator dot
            const dot = document.createElement('div');
            dot.className = 'cal-day-dot';
            if (dayInfo.activity_level === 'High') dot.classList.add('dot-high');
            else if (dayInfo.activity_level === 'Medium') dot.classList.add('dot-med');
            else if (dayInfo.activity_level === 'Low') dot.classList.add('dot-low');
            else dot.classList.add('dot-spo');
            dayEl.appendChild(dot);

            dayEl.addEventListener('click', () => {
                document.querySelectorAll('.cal-day-box').forEach(d => d.classList.remove('active'));
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

// Request Live Machine Learning Prediction for Selected Date
async function triggerPrediction(dateStr) {
    try {
        const res = await fetch(`/api/predict/date?date=${dateStr}`);
        if (!res.ok) throw new Error('Prediction API failed');
        const pred = await res.json();

        // 1. Update Right Prediction Panel UI
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

        if (dateBanner) dateBanner.textContent = pred.date_formatted || pred.date;
        if (solLonBanner) solLonBanner.textContent = `SOLAR LONGITUDE: ${pred.solar_longitude}° • DAY ${pred.day_of_year}`;

        if (actBadge) {
            actBadge.textContent = `${pred.activity_level.toUpperCase()} ACTIVITY`;
            actBadge.className = 'activity-badge';
            if (pred.activity_level === 'High') actBadge.classList.add('badge-high');
            else if (pred.activity_level === 'Medium') actBadge.classList.add('badge-med');
            else if (pred.activity_level === 'Low') actBadge.classList.add('badge-low');
            else actBadge.classList.add('badge-spo');
        }

        if (confVal) confVal.textContent = pred.confidence_percentage || `${(pred.confidence * 100).toFixed(1)}%`;
        if (confFill) confFill.style.width = `${Math.min(100, (pred.confidence || 0.9) * 100)}%`;

        if (showerName) showerName.textContent = `${pred.predicted_shower} (${pred.iau_code})`;
        if (parentBody) parentBody.textContent = pred.parent_body || 'Interplanetary Dust Background';
        if (radiant && pred.radiant) radiant.textContent = `${pred.radiant.ra}° / ${pred.radiant.dec > 0 ? '+' : ''}${pred.radiant.dec}°`;
        if (velocity) velocity.textContent = `${pred.velocity_km_s} km/s`;
        if (peakMag) peakMag.textContent = `${pred.predicted_peak_mag} mag`;
        if (duration) duration.textContent = `${pred.predicted_duration_s}s`;
        if (provText) provText.textContent = pred.dataset_source;

        // 2. Synchronize Left Observatory Panel UI
        const obsName = document.getElementById('obs-stream-name');
        const obsTier = document.getElementById('obs-stream-tier');
        const obsZhr = document.getElementById('obs-stream-zhr');
        const obsParent = document.getElementById('obs-parent');
        const obsVelocity = document.getElementById('obs-velocity');
        const obsRadiantRa = document.getElementById('obs-radiant-ra');
        const obsRadiantDec = document.getElementById('obs-radiant-dec');
        const obsSolLon = document.getElementById('obs-sol-lon');
        const obsPeakMag = document.getElementById('obs-peak-mag');

        if (obsName) obsName.textContent = pred.predicted_shower;
        if (obsTier) {
            obsTier.textContent = `${pred.activity_level} Activity`;
            obsTier.className = `tier-pill pill-${pred.activity_level.toLowerCase().substring(0, 3)}`;
        }
        if (obsZhr) obsZhr.textContent = `~${pred.zhr_estimate || 15} ZHR`;
        if (obsParent) obsParent.textContent = pred.parent_body || 'Interplanetary Medium';
        if (obsVelocity) obsVelocity.textContent = `${pred.velocity_km_s} km/s`;
        if (obsRadiantRa && pred.radiant) obsRadiantRa.textContent = `${pred.radiant.ra}°`;
        if (obsRadiantDec && pred.radiant) obsRadiantDec.textContent = `${pred.radiant.dec > 0 ? '+' : ''}${pred.radiant.dec}°`;
        if (obsSolLon) obsSolLon.textContent = `${pred.solar_longitude}°`;
        if (obsPeakMag) obsPeakMag.textContent = `${pred.predicted_peak_mag} mag`;

        // 3. Re-orient 3D Meteor Stream to match predicted shower radiant
        if (pred.iau_code && pred.iau_code !== 'SPO') {
            state.activeStreamFilter = pred.iau_code;
            const select = document.getElementById('stream-quick-select');
            if (select) {
                const optExists = Array.from(select.options).some(o => o.value === pred.iau_code);
                if (optExists) select.value = pred.iau_code;
            }
            load3DData(pred.iau_code);
        }

    } catch (err) {
        console.error('Error triggering prediction:', err);
    }
}

// Update Left Panel directly when a specific shower is chosen from dropdown
function updateObservatoryPanel(showerCode) {
    const s = getCatalogShower(showerCode);
    const obsName = document.getElementById('obs-stream-name');
    const obsTier = document.getElementById('obs-stream-tier');
    const obsZhr = document.getElementById('obs-stream-zhr');
    const obsParent = document.getElementById('obs-parent');
    const obsVelocity = document.getElementById('obs-velocity');
    const obsRadiantRa = document.getElementById('obs-radiant-ra');
    const obsRadiantDec = document.getElementById('obs-radiant-dec');
    const obsSolLon = document.getElementById('obs-sol-lon');
    const obsPeakMag = document.getElementById('obs-peak-mag');

    if (obsName) obsName.textContent = `${s.name} (${s.code})`;
    if (obsTier) {
        obsTier.textContent = `${s.tier} Activity`;
        obsTier.className = `tier-pill pill-${s.tier.toLowerCase().substring(0, 3)}`;
    }
    if (obsZhr) obsZhr.textContent = `~${s.zhr} ZHR`;
    if (obsParent) obsParent.textContent = s.parent;
    if (obsVelocity) obsVelocity.textContent = `${s.vel} km/s`;
    if (obsRadiantRa) obsRadiantRa.textContent = `${s.ra}°`;
    if (obsRadiantDec) obsRadiantDec.textContent = `${s.dec > 0 ? '+' : ''}${s.dec}°`;
    if (obsSolLon) obsSolLon.textContent = `${s.sol_lon}°`;
    if (obsPeakMag) obsPeakMag.textContent = `${s.peak_mag} mag`;
}

// ==========================================================================
// EVENT LISTENERS & SYNCHRONIZED DYNAMICS CONTROLS
// ==========================================================================
async function loadInitialData() {
    try {
        const [statsRes, modelRes] = await Promise.all([
            fetch('/api/statistics').then(r => r.json()).catch(() => null),
            fetch('/api/model-info').then(r => r.json()).catch(() => null)
        ]);

        state.stats = statsRes;
        state.modelInfo = modelRes;

        // Render Calendar dynamically for current real-world date
        await renderCalendar(state.calendarYear, state.calendarMonth);
        await triggerPrediction(state.selectedDate);
        await load3DData(state.activeStreamFilter);

    } catch (err) {
        console.error('Error loading initial data:', err);
    }
}

function setupEventListeners() {
    // Calendar Navigation
    document.getElementById('cal-prev')?.addEventListener('click', () => {
        state.calendarMonth--;
        if (state.calendarMonth < 1) {
            state.calendarMonth = 12;
            state.calendarYear--;
        }
        renderCalendar(state.calendarYear, state.calendarMonth);
    });

    document.getElementById('cal-next')?.addEventListener('click', () => {
        state.calendarMonth++;
        if (state.calendarMonth > 12) {
            state.calendarMonth = 1;
            state.calendarYear++;
        }
        renderCalendar(state.calendarYear, state.calendarMonth);
    });

    document.getElementById('cal-today')?.addEventListener('click', () => {
        const today = new Date();
        state.calendarYear = today.getFullYear();
        state.calendarMonth = today.getMonth() + 1;
        const todayStr = `${state.calendarYear}-${String(state.calendarMonth).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        state.selectedDate = todayStr;
        renderCalendar(state.calendarYear, state.calendarMonth);
        triggerPrediction(todayStr);
    });

    // Stream Selector
    document.getElementById('stream-quick-select')?.addEventListener('change', (e) => {
        state.activeStreamFilter = e.target.value;
        updateObservatoryPanel(state.activeStreamFilter);
        load3DData(state.activeStreamFilter);
    });

    // ======================================================================
    // EARTH SPIN & ROTATION CONTROLS (SYNCHRONIZED LEFT & BOTTOM)
    // ======================================================================
    const earthSpinSliderLeft = document.getElementById('earth-spin-slider');
    const earthSpinSliderBottom = document.getElementById('earth-spin-slider-bottom');
    const earthSpinValLeft = document.getElementById('earth-spin-val');
    const earthSpinValBottom = document.getElementById('earth-spin-val-bottom');

    function syncEarthSpin(val) {
        state.earthSpinRate = parseFloat(val);
        state.earthSpinPaused = false;
        if (earthSpinSliderLeft) earthSpinSliderLeft.value = state.earthSpinRate;
        if (earthSpinSliderBottom) earthSpinSliderBottom.value = state.earthSpinRate;
        const dir = state.earthSpinRate > 0 ? 'Prograde' : (state.earthSpinRate < 0 ? 'Retrograde' : 'Still');
        const formatted = `${Math.abs(state.earthSpinRate).toFixed(1)}x`;
        if (earthSpinValLeft) earthSpinValLeft.textContent = `${formatted} ${dir}`;
        if (earthSpinValBottom) earthSpinValBottom.textContent = formatted;
    }

    earthSpinSliderLeft?.addEventListener('input', (e) => syncEarthSpin(e.target.value));
    earthSpinSliderBottom?.addEventListener('input', (e) => syncEarthSpin(e.target.value));

    function reverseEarthSpin() {
        syncEarthSpin(-state.earthSpinRate);
    }

    document.getElementById('btn-reverse-spin')?.addEventListener('click', reverseEarthSpin);
    document.getElementById('btn-reverse-spin-bottom')?.addEventListener('click', reverseEarthSpin);

    document.getElementById('btn-pause-spin')?.addEventListener('click', (e) => {
        state.earthSpinPaused = !state.earthSpinPaused;
        e.target.textContent = state.earthSpinPaused ? '▶ Resume Spin' : '⏸ Pause Spin';
        if (earthSpinValLeft) {
            earthSpinValLeft.textContent = state.earthSpinPaused ? 'Paused' : `${Math.abs(state.earthSpinRate).toFixed(1)}x`;
        }
    });

    // ======================================================================
    // METEOR FALL DIRECTION & INTENSITY CONTROLS (SYNCHRONIZED)
    // ======================================================================
    const streamDirPresetLeft = document.getElementById('stream-dir-preset');
    const streamDirPresetBottom = document.getElementById('stream-dir-preset-bottom');

    function syncStreamDir(mode) {
        state.streamDirectionMode = mode;
        if (streamDirPresetLeft) streamDirPresetLeft.value = mode;
        if (streamDirPresetBottom) streamDirPresetBottom.value = mode;
        realignMeteorTrajectories();
    }

    streamDirPresetLeft?.addEventListener('change', (e) => syncStreamDir(e.target.value));
    streamDirPresetBottom?.addEventListener('change', (e) => syncStreamDir(e.target.value));

    const streamAngleSlider = document.getElementById('stream-angle-slider');
    const streamAngleVal = document.getElementById('stream-angle-val');
    if (streamAngleSlider) {
        streamAngleSlider.addEventListener('input', (e) => {
            state.customStreamAzimuth = parseFloat(e.target.value);
            syncStreamDir('custom');
            if (streamAngleVal) {
                streamAngleVal.textContent = `${state.customStreamAzimuth}° ${getCompassHeading(state.customStreamAzimuth)}`;
            }
        });
    }

    const streamDensitySelect = document.getElementById('stream-density-select');
    if (streamDensitySelect) {
        streamDensitySelect.addEventListener('change', (e) => {
            state.densityLimit = parseInt(e.target.value);
            load3DData(state.activeStreamFilter);
        });
    }

    // Camera Presets
    document.getElementById('cam-earth')?.addEventListener('click', (e) => {
        setActiveCamBtn(e.target);
        animateCameraTo(new THREE.Vector3(0, 0.8, 6.6), new THREE.Vector3(0, 0, 0), 750);
    });

    document.getElementById('cam-radiant')?.addEventListener('click', (e) => {
        setActiveCamBtn(e.target);
        const s = getCatalogShower(state.activeStreamFilter);
        const rDir = radiantToDirectionVector(s.ra, s.dec);
        const radiantCamPos = rDir.clone().multiplyScalar(5.8);
        animateCameraTo(radiantCamPos, new THREE.Vector3(0, 0, 0), 850);
    });

    document.getElementById('cam-pole')?.addEventListener('click', (e) => {
        setActiveCamBtn(e.target);
        animateCameraTo(new THREE.Vector3(0, 7.2, 0.6), new THREE.Vector3(0, 0, 0), 800);
    });

    function setActiveCamBtn(btn) {
        document.querySelectorAll('.cam-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    // Floating Bottom Controls Bar
    document.getElementById('toggle-animation')?.addEventListener('click', (e) => {
        state.animationRunning = !state.animationRunning;
        e.target.textContent = state.animationRunning ? '⏸️ Pause' : '▶️ Resume';
    });

    // Interactive Earth Zoom Controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        if (!camera) return;
        const currentDist = camera.position.distanceTo(controls.target);
        const newDist = Math.max(controls.minDistance, currentDist * 0.78);
        const newPos = camera.position.clone().sub(controls.target).normalize().multiplyScalar(newDist).add(controls.target);
        animateCameraTo(newPos, controls.target, 450);
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        if (!camera) return;
        const currentDist = camera.position.distanceTo(controls.target);
        const newDist = Math.min(controls.maxDistance, currentDist * 1.28);
        const newPos = camera.position.clone().sub(controls.target).normalize().multiplyScalar(newDist).add(controls.target);
        animateCameraTo(newPos, controls.target, 450);
    });

    document.getElementById('btn-fit-screen')?.addEventListener('click', () => {
        // Fits Earth cleanly to ~60% of viewport
        animateCameraTo(new THREE.Vector3(0, 0.6, 5.2), new THREE.Vector3(0, 0, 0), 650);
    });

    document.getElementById('reset-camera')?.addEventListener('click', () => {
        animateCameraTo(new THREE.Vector3(0, 0.8, 6.6), new THREE.Vector3(0, 0, 0), 700);
    });

    // Layer Toggles
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

    document.getElementById('toggle-meteors')?.addEventListener('click', (e) => {
        state.showMeteors = !state.showMeteors;
        e.target.classList.toggle('active', state.showMeteors);
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

    // Predictor Lab Form & Presets
    setupPredictorLab();

    // Data Explorer
    setupDataExplorer();

    // Modal close
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('modal')?.classList.add('hidden');
        });
    });
}

function onWindowResize() {
    const container = document.getElementById('scene-container');
    if (!container || !renderer || !camera) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    if (width === 0 || height === 0) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function onMouseMove(event) {
    const container = document.getElementById('scene-container');
    if (!container || !renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meteorGroup.children);

    const tooltip = document.getElementById('meteor-tooltip');
    if (intersects.length > 0) {
        const item = intersects[0].object.userData;
        if (item && tooltip) {
            document.getElementById('tip-id').textContent = item.id || 'Observation ID';
            document.getElementById('tip-shower').textContent = `${item.shower || 'Sporadic'} (${item.iau_code || 'SPO'})`;
            document.getElementById('tip-vel').textContent = item.vgeo != null ? `${item.vgeo.toFixed(1)} km/s` : '-';
            document.getElementById('tip-peak').textContent = item.peak != null ? `${item.peak.toFixed(1)} mag` : '-';
            document.getElementById('tip-dur').textContent = item.duration != null ? `${item.duration.toFixed(2)}s` : '-';
            document.getElementById('tip-loc').textContent = item.lat_beg != null ? `${item.lat_beg.toFixed(1)}°, ${item.lon_beg?.toFixed(1)}°` : 'Space Trajectory';
            document.getElementById('tip-alt').textContent = item.ht_beg != null ? `${item.ht_beg.toFixed(1)} km` : '100 km';
            tooltip.classList.remove('hidden');
        }
    } else if (tooltip) {
        tooltip.classList.add('hidden');
    }
}

// ==========================================================================
// OBSERVATORY DASHBOARD VIEW
// ==========================================================================
function renderDashboard() {
    if (!state.stats) return;

    document.getElementById('metric-total').textContent = state.stats.total_meteors?.toLocaleString() || '4,733';
    document.getElementById('metric-known').textContent = state.stats.known_showers?.toLocaleString() || '1,069';
    document.getElementById('metric-sporadic').textContent = state.stats.sporadic?.toLocaleString() || '3,664';
    document.getElementById('metric-unique').textContent = state.stats.unique_showers || '32';
    document.getElementById('metric-vel').textContent = `${(state.stats.avg_velocity || 40.3).toFixed(1)} km/s`;
    document.getElementById('metric-peak').textContent = `${(state.stats.avg_peak || 0.04).toFixed(2)}`;

    const carousel = document.getElementById('major-showers-list');
    if (carousel) {
        carousel.innerHTML = MAJOR_SHOWERS_CATALOG.map(s => `
            <div class="shower-card-item" onclick="window.focusShower('${s.code}')">
                <div class="sc-header">
                    <span class="sc-code numeric">${s.code}</span>
                    <span class="tier-pill pill-${s.tier.toLowerCase().substring(0, 3)}">${s.tier}</span>
                </div>
                <div class="sc-name">${s.name}</div>
                <div class="sc-dates">Peak: ${s.peak} (${s.dates})</div>
                <div class="sc-meta">
                    <span class="numeric">${s.vel} km/s</span>
                    <span class="numeric">~${s.zhr} ZHR</span>
                    <span class="numeric">RA ${s.ra}°</span>
                </div>
            </div>
        `).join('');
    }

    const topList = document.getElementById('top-showers-list');
    if (topList && state.stats.top_showers) {
        topList.innerHTML = state.stats.top_showers.slice(0, 8).map(s => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: rgba(255,255,255,0.02); margin-bottom: 6px; border-radius: 6px;">
                <span style="font-weight: 600; color: #fff;">${s.name}</span>
                <span class="numeric" style="color: var(--accent); font-weight: 600;">${s.count} events</span>
            </div>
        `).join('');
    }

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
                <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 4px;">
                    <span style="color: #fff;">${it.label}</span>
                    <span class="numeric" style="color: ${it.color}; font-weight: 700;">${it.count} (${((it.count/total)*100).toFixed(1)}%)</span>
                </div>
                <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
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
    if (select) {
        const optExists = Array.from(select.options).some(o => o.value === code);
        if (optExists) select.value = code;
    }
    updateObservatoryPanel(code);
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

    const tbody = document.getElementById('per-class-tbody');
    if (tbody && m.per_class) {
        tbody.innerHTML = Object.entries(m.per_class).map(([className, met]) => `
            <tr>
                <td><strong>${className}</strong></td>
                <td class="numeric">${(met.precision * 100).toFixed(1)}%</td>
                <td class="numeric">${(met.recall * 100).toFixed(1)}%</td>
                <td class="numeric">${(met.f1 * 100).toFixed(1)}%</td>
                <td class="numeric">${met.support} samples</td>
            </tr>
        `).join('');
    }

    const featList = document.getElementById('feature-importances-list');
    if (featList && m.feature_importances) {
        const maxImp = m.feature_importances[0]?.importance || 0.3;
        featList.innerHTML = m.feature_importances.map(f => `
            <div class="feature-row">
                <div class="feat-meta">
                    <span class="feat-name">${f.feature}</span>
                    <span class="feat-val numeric">${(f.importance * 100).toFixed(1)}%</span>
                </div>
                <div class="feat-bar">
                    <div class="feat-fill" style="width: ${(f.importance / maxImp) * 100}%;"></div>
                </div>
            </div>
        `).join('');
    }

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
                tableHtml += `<td class="numeric" style="background: ${bg}; color: ${color};">${val}</td>`;
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        matrixCont.innerHTML = tableHtml;
    }
}

// ==========================================================================
// PREDICTOR LAB SETUP
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
                    <div style="display: flex; flex-direction: column; gap: 14px;">
                        <div style="background: rgba(0,240,255,0.08); padding: 12px; border-radius: 8px; border-left: 3px solid var(--accent);">
                            <span style="font-size: 0.72rem; color: var(--text-muted);">PREDICTED SHOWER STREAM</span>
                            <h3 style="font-family: var(--font-heading); color: #fff; margin: 4px 0;">${out.shower_prediction.predicted_shower}</h3>
                            <span class="numeric" style="font-size: 0.8rem; color: var(--accent);">Random Forest Confidence: ${(out.shower_prediction.confidence * 100).toFixed(1)}%</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">Peak Magnitude</span>
                                <strong class="numeric" style="color: #fff; font-size: 1.1rem;">${out.peak_magnitude.value.toFixed(2)}</strong>
                                <span style="font-size: 0.72rem; color: var(--accent); display: block;">${out.peak_magnitude.intensity_class}</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">Predicted Duration</span>
                                <strong class="numeric" style="color: #fff; font-size: 1.1rem;">${out.duration.formatted}</strong>
                                <span style="font-size: 0.72rem; color: var(--accent); display: block;">${out.duration.class} Track</span>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">Kinetic Energy (J)</span>
                                <strong class="numeric" style="color: #fff; font-size: 0.95rem;">${out.estimated_energy_joules.toExponential(2)} J</strong>
                            </div>
                            <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px;">
                                <span style="font-size: 0.68rem; color: var(--text-muted); display: block;">Risk Level</span>
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
// DATA EXPLORER SETUP
// ==========================================================================
function setupDataExplorer() {
    const searchInput = document.getElementById('search-input');
    const showerFilter = document.getElementById('data-shower-filter');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

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
                <td class="numeric" style="color: var(--accent); font-weight: 600;">${m.id}</td>
                <td><strong style="color: #fff;">${m.iau_shower}</strong> (${m.iau_code})</td>
                <td><span class="tier-pill pill-${(m.activity || 'spo').toLowerCase().substring(0, 3)}">${m.activity || 'Sporadic'}</span></td>
                <td class="numeric">${m.sol_lon ? m.sol_lon.toFixed(2) + '°' : '-'}</td>
                <td class="numeric">${m.rageo ? `${m.rageo.toFixed(1)}° / ${m.decgeo?.toFixed(1)}°` : '-'}</td>
                <td class="numeric">${m.vgeo ? m.vgeo.toFixed(1) + ' km/s' : '-'}</td>
                <td class="numeric">${m.peak != null ? m.peak.toFixed(2) : '-'}</td>
                <td class="numeric">${m.duration != null ? m.duration.toFixed(2) + 's' : '-'}</td>
                <td class="numeric">${m.lat_beg != null ? `${m.lat_beg.toFixed(1)}°, ${m.lon_beg?.toFixed(1)}°` : '-'}</td>
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
                        <div class="detail-val numeric">${item[k] !== null && item[k] !== undefined ? item[k] : 'N/A'}</div>
                    </div>
                `).join('')}
            </div>
        `;

        modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error inspecting meteor:', err);
    }
};
