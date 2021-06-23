window.focus();

let camera, scene, renderer; // ThreeJS globals
let world; // CannonJs world
let lastTime; // Lëvizja e fundit e animacionit
let stack; // Pjesët e objektit të cilat qëndrojnë njëra pas tjetrës (stack)
let overhangs; // Pjesë të objektit (figurës) të cilat bien poshtë
const boxHeight = 1; // Lartësia e objektit
const originalBoxSize = 3; //Gjerësia dhe lartësia origjinale e një kutie   
let autopilot; //Mundëson që kutia që lëviz të orientohen afër kutis tjetër
let gameEnded;
let robotPrecision; // Përcakton sa precize është loja në autopilot

const scoreElement = document.getElementById("score");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");

init();

// Përcakton sa precize është loja në autopilot
function setRobotPrecision() {
    robotPrecision = Math.random() * 1 - 0.5;
}


function init() {
    autopilot = true;
    gameEnded = false;
    lastTime = 0;
    stack = [];
    overhangs = [];
    setRobotPrecision();

    // Incializimi i CannonJS
    world = new CANNON.World();
    world.gravity.set(0, -10, 0); // Graviteti i cili tërheq kutitë
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // Incializimi i ThreeJs
    const aspect = window.innerWidth / window.innerHeight;
    const width = 10;
    const height = width / aspect;

    camera = new THREE.OrthographicCamera(
        width / -2, // majtë
        width / 2, // djathë
        height / 2, // lartë
        height / -2, // poshtë
        0, // afër
        100 // larg
    );

    camera = new THREE.PerspectiveCamera(
        50, // Shikimi i objketit
        aspect, // raporti i gjerësisë me lartësinë e një imazhi ose ekrani.
        1, // afër 
        100 // larg 
    );


    camera.position.set(4, 4, 4); //Pozicionimi i kamerës
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();

    //Fotografia në background
    const loader = new THREE.TextureLoader();
    loader.load('https://images.unsplash.com/photo-1501619757722-90657a99803b?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1950&q=80', function(texture) {
        scene.background = texture;
    });

    // Baza
    addLayer(0, 0, originalBoxSize, originalBoxSize);


    // Shtresa e parë
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

    // Dritat
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 0);
    scene.add(dirLight);

    // Rendereri
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    document.body.appendChild(renderer.domElement);
}

function startGame() {
    autopilot = false;
    gameEnded = false;
    lastTime = 0;
    stack = [];
    overhangs = [];

    if (instructionsElement) instructionsElement.style.display = "none";
    if (resultsElement) resultsElement.style.display = "none";
    if (scoreElement) scoreElement.innerText = 0;

    if (world) {
        // largon çdo objekt nga bota 
        while (world.bodies.length > 0) {
            world.remove(world.bodies[0]);
        }
    }

    if (scene) {
        // Hiqni çdo Mesh nga skena   //Një mesh është një objekt që merr një gjeometri
        while (scene.children.find((c) => c.type == "Mesh")) {
            const mesh = scene.children.find((c) => c.type == "Mesh");
            scene.remove(mesh);
        }

        // Baza
        addLayer(0, 0, originalBoxSize, originalBoxSize);

        // Shtresa e parë
        addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");
    }
    //Pozicionimi i kamerës
    if (camera) {
        // Pozicionimi i kamerës kur bëhet reset
        camera.position.set(5, 5, 5);
        camera.lookAt(0, 0, 0);
    }
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length; // Shton kutinë e re një shtresë më të lartë
    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;
    stack.push(layer);
}

function addOverhang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1); // Shton kutinë e re në të njëjtën shtresë
    const overhang = generateBox(x, y, z, width, depth, true);
    overhangs.push(overhang);
}

function generateBox(x, y, z, width, depth, falls) {
    // ThreeJS
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
    const color = new THREE.Color(`hsl(${30 + stack.length * 4}, 100%, 50%)`); //Ngjyrat
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // CannonJS
    //Forma e kutisë
    const shape = new CANNON.Box(
        new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
    );
    let mass = falls ? 5 : 0; // Nëse nuk duhet të bjerë, vendosja e masës në zero do ta mbajë atë të palëvizshme
    mass *= width / originalBoxSize; //Zvogëloni masën proporcionalisht sipas madhësisë
    mass *= depth / originalBoxSize;
    const body = new CANNON.Body({ mass, shape });
    body.position.set(x, y, z);
    world.addBody(body);

    return {
        threejs: mesh,
        cannonjs: body,
        width,
        depth
    };
}

function cutBox(topLayer, overlap, size, delta) {
    const direction = topLayer.direction;
    const newWidth = direction == "x" ? overlap : topLayer.width;
    const newDepth = direction == "z" ? overlap : topLayer.depth;

    // Azhurnoni të dhënat
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    // Azhurnoni ThreeJS modelin
    topLayer.threejs.scale[direction] = overlap / size;
    topLayer.threejs.position[direction] -= delta / 2;

    // Azhurnoni CannonJS modelin
    topLayer.cannonjs.position[direction] -= delta / 2;

    // Zëvendësoni formën në një më të vogël
    const shape = new CANNON.Box(
        new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
    );
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);
}

window.addEventListener("mousedown", eventHandler);
window.addEventListener("touchstart", eventHandler);
window.addEventListener("keydown", function(event) {
    if (event.key == " ") {
        event.preventDefault();
        eventHandler();
        return;
    }

    //Restarto lojën
    if (event.key == "R" || event.key == "r") {
        event.preventDefault();
        startGame();
        return;
    }
});

function eventHandler() {
    if (autopilot) startGame();
    else splitBlockAndAddNextOneIfOverlaps();
}

function splitBlockAndAddNextOneIfOverlaps() {
    if (gameEnded) return;

    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];

    const direction = topLayer.direction;

    const size = direction == "x" ? topLayer.width : topLayer.depth;
    const delta =
        topLayer.threejs.position[direction] -
        previousLayer.threejs.position[direction];
    const overhangSize = Math.abs(delta);
    const overlap = size - overhangSize;

    if (overlap > 0) {
        cutBox(topLayer, overlap, size, delta);

        // Mbingarkesa
        const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
        const overhangX =
            direction == "x" ?
            topLayer.threejs.position.x + overhangShift :
            topLayer.threejs.position.x;
        const overhangZ =
            direction == "z" ?
            topLayer.threejs.position.z + overhangShift :
            topLayer.threejs.position.z;
        const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
        const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

        addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

        // Shtresa tjetër
        const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
        const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
        const newWidth = topLayer.width; // New layer has the same size as the cut top layer
        const newDepth = topLayer.depth; // New layer has the same size as the cut top layer
        const nextDirection = direction == "x" ? "z" : "x";

        if (scoreElement) scoreElement.innerText = stack.length - 1;
        addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    } else {
        missedTheSpot();
    }
}

function missedTheSpot() {
    const topLayer = stack[stack.length - 1];

    // Kthen shtresën e sipërme në një tejkalim dhe e lëj të bjerë poshtë
    addOverhang(
        topLayer.threejs.position.x,
        topLayer.threejs.position.z,
        topLayer.width,
        topLayer.depth
    );
    world.remove(topLayer.cannonjs);
    scene.remove(topLayer.threejs);

    gameEnded = true;
    if (resultsElement && !autopilot) resultsElement.style.display = "flex";
}
//Shpejtësia e lëvizjes së kutive
function animation(time) {
    if (lastTime) {
        const timePassed = time - lastTime;
        const speed = 0.006;

        const topLayer = stack[stack.length - 1];
        const previousLayer = stack[stack.length - 2];

        // Kutia e nivelit të lartë duhet të lëvizë nëse loja nuk ka përfunduar
        const boxShouldMove = !gameEnded &&
            (!autopilot ||
                (autopilot &&
                    topLayer.threejs.position[topLayer.direction] <
                    previousLayer.threejs.position[topLayer.direction] +
                    robotPrecision));

        if (boxShouldMove) {
            //Mbani pozicionin të dukshëm në UI dhe pozicionin në modelin sinkronizues
            topLayer.threejs.position[topLayer.direction] += speed * timePassed;
            topLayer.cannonjs.position[topLayer.direction] += speed * timePassed;

            // Nëse kutia shkon përtej kutisë tjetër atëherë shfaq ekranin e dështimit (fail)
            if (topLayer.threejs.position[topLayer.direction] > 10) {
                missedTheSpot();
            }
        } else {

            if (autopilot) {
                splitBlockAndAddNextOneIfOverlaps();
                setRobotPrecision();
            }
        }

        // 4 është lartësia fillestare e kamerës
        if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
            camera.position.y += speed * timePassed;
        }

        updatePhysics(timePassed);
        renderer.render(scene, camera);
    }
    lastTime = time;
}

function updatePhysics(timePassed) {
    world.step(timePassed / 1000);

    // Kopjoni koordinatat nga Cannon.js në Three.js
    overhangs.forEach((element) => {
        element.threejs.position.copy(element.cannonjs.position);
        element.threejs.quaternion.copy(element.cannonjs.quaternion);
    });
}

window.addEventListener("resize", () => {
    // Rregullon kamerën
    console.log("resize", window.innerWidth, window.innerHeight);
    const aspect = window.innerWidth / window.innerHeight;
    const width = 10;
    const height = width / aspect;

    camera.top = height / 2;
    camera.bottom = height / -2;

    // Ristarto rendererin
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.render(scene, camera);
});