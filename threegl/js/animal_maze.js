// global vars and constants
const nearPlane = 0.1;
const DEFAULT_SIZE_MAZE = 10;
const RED_COLOUR = 0xFF0000;
const DISTANCE_TO_END_MAZE = 30;
const ROTATION_SIDES = 0.03;
const AMBIENT_COLOUR = 0xffffff;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS; // 16.67ms needed for 60 FPS
var renderer, scene, camera, cameraTop;
var walls = [];
var wallMeshes = []; // to save meshes in walls for collisions
var currentLevel = 1;
var mazeCreator;
var cellSize;
var mazeSize;
var playerPosition = new THREE.Vector3();
var positionAnimal = new THREE.Vector3();
var playerRotation = 0;
var clock = new THREE.Clock();
var playerDot; // player identifier in minimap
var animalMarker; // animal at the end of maze marker in minimap
var raycaster = new THREE.Raycaster(); // for collisions
var currentSizeByLevelMaze = DEFAULT_SIZE_MAZE
var lastFrameTime = 0;

// GUI controls
var controls = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    speed: 0.5,
    wireframe: false,
    showMinimap: true,
    currentSizeByLevelMaze: DEFAULT_SIZE_MAZE,
};

// resources monitor
const stats = new Stats();

// Event listeners para controles
document.addEventListener('keydown', function(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = true;
            event.preventDefault();
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = true;
            event.preventDefault();
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = true;
            event.preventDefault();
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = true;
            event.preventDefault();
            break;
    }
});

document.addEventListener('keyup', function(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            controls.moveForward = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            controls.moveBackward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            controls.moveLeft = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            controls.moveRight = false;
            break;
    }
});

// 1-inicializa 
init();
// 2-Crea una escena
loadScene();
setGUI();
// 4-renderiza
render();

function setGUI() {
    var gui = new dat.GUI({ width: 325 });
    
    // maze debug menu folder
    var gui_maze = gui.addFolder('Opciones Laberinto');
    gui_maze.add(controls, 'speed', 0.1, 2.0).name("Velocidad").listen();
    gui_maze.add(controls, 'showMinimap').name("Mostrar minimapa").listen();
    gui_maze.add(controls, 'currentSizeByLevelMaze', 10, 30).name("Cambiar nivel laberinto").listen();
    
    // maze debug menu wireframe option
    gui.add(controls, 'wireframe').name('Alambres').onChange(function(value) {
        updateWireframe(value);
    });
    
    gui_maze.open();
}

function updateWireframe(wireframe) {
    scene.traverse(function(object) {
        if (object instanceof THREE.Mesh) {
            if (object.material) {
                object.material.wireframe = wireframe;
            }
        }
    });
}

function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.autoClear = true;
    document.getElementById('container').appendChild(renderer.domElement);

    // FPS
    stats.showPanel(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '700px';
    stats.domElement.style.zIndex = '200';
    stats.domElement.style.pointerEvents = 'none';
    stats.domElement.style.transform = 'scale(0.8)';
    document.getElementById('container').appendChild(stats.domElement);

    scene = new THREE.Scene();

    var aspectRatio = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspectRatio, nearPlane, 1000);
    
    // orthographic camera from top-down view
    const yPosMinimap = 40, orthoCameraSize = 1000
    const frustrumFarPlane = 150, frustrumNearPlane = 2
    cameraTop = new THREE.OrthographicCamera(
        -orthoCameraSize,
        orthoCameraSize, orthoCameraSize,
        -orthoCameraSize, frustrumNearPlane,
        frustrumFarPlane
    );
    cameraTop.position.set(0, yPosMinimap, 0);
    cameraTop.lookAt(0, 0, 0);
    cameraTop.up.set(0, 0, -1);
    cameraTop.updateProjectionMatrix();

    window.addEventListener('resize', updateAspectRatio);
}

function createWallTexture(path) {
    const textureLoader = new THREE.TextureLoader();
    const textureForWalls = textureLoader.load(path);
    textureForWalls.wrapS = THREE.RepeatWrapping;  
    textureForWalls.wrapT = THREE.RepeatWrapping; 
    textureForWalls.repeat.set(0.5, 0.5);

    textureForWalls.magFilter = THREE.NearestFilter;  // filter magnification
    textureForWalls.minFilter = THREE.NearestFilter;  // filter minification
    return textureForWalls;
}

function loadScene() {
    // setups depending on the level
    mazeSize = currentLevel === 1 ? controls.currentSizeByLevelMaze : controls.currentSizeByLevelMaze + 5;
    cellSize = 1000 / mazeSize;
    mazeCreator = new MazeCreator(mazeSize, mazeSize);

    // clean previous scene
    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    walls = [];
    wallMeshes = [];

    // sky and fog colour depending on level
    fogIntesity = 500 // 800 is few fog
    firstLevelColour = 0x87CEEB // kind of blue sky colour / to more greenish a B at the end
    secondLevelColour = 0x006994 // sea-like colour
    var bgColor = currentLevel === 1 ? firstLevelColour : secondLevelColour;
    scene.background = new THREE.Color(bgColor);
    scene.fog = new THREE.Fog(bgColor, 0,fogIntesity);

    // floor depending on level
    firstLevelFloorColour = 0xC19A6B
    secondLevelFloorColour = 0x4682B4
    var floorGeometry = new THREE.PlaneGeometry(1000, 1000);
    var floorColor = currentLevel === 1 ? firstLevelFloorColour : secondLevelFloorColour;
    var floorMaterial = new THREE.MeshPhongMaterial({
        color: floorColor,
        side: THREE.DoubleSide
    });
    var floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    createWallsFromMaze();

    // Animal at the end of the maze
    
    if (currentLevel === 1) {
        // monkey
        createAnimalTexture('models/japanese_monkey/scene.gltf')
    } else {
        // fish
        createAnimalTexture('models/shiny_fish/scene.gltf')
    }
    
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    cubemap = cubeTextureLoader.load([
        'skybox/phobos_lf.jpg', 
        'skybox/phobos_rt.jpg', 
        'skybox/phobos_up.jpg', 
        'skybox/phobos_dn.jpg', 
        'skybox/phobos_ft.jpg',  
        'skybox/phobos_bk.jpg' 
    ], 
        function (texture) {
            console.log('Cubemap loaded.');
        }, 
        undefined, 
        function (error) {
            console.error('Error loading cubemap', error);
        }
    );
    
    // create a skybox: big inverted cube
    // load 6 textures  each one for skybox
    const textureLoader = new THREE.TextureLoader();    
    const materials = [
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_lf.jpg'), side: THREE.BackSide }), 
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_rt.jpg'), side: THREE.BackSide }), 
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_up.jpg'), side: THREE.BackSide }), 
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_dn.jpg'), side: THREE.BackSide }), 
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_ft.jpg'), side: THREE.BackSide }), 
        new THREE.MeshBasicMaterial({ map: textureLoader.load('skybox/phobos_bk.jpg'), side: THREE.BackSide })  
    ];

    const skyboxGeometry = new THREE.BoxGeometry(1000, 1000, 1000); // big cube
    const skybox = new THREE.Mesh(skyboxGeometry, materials);

    scene.add(skybox);
    
    // create a reflect material
    const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
    const reflectiveMaterial = new THREE.MeshPhongMaterial({
        envMap: cubemap // Usar el cubemap como entorno reflectante
    });
    const sphere = new THREE.Mesh(sphereGeometry, reflectiveMaterial);
    sphere.position.x = 0; // Posicionar la esfera
    scene.add(sphere);

    // ambient light
    var ambientLight = new THREE.AmbientLight(AMBIENT_COLOUR, 0.7);
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(AMBIENT_COLOUR, 1.0);
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.camera.far = 1000;
    scene.add(directionalLight);

    var hemisphereLight = new THREE.HemisphereLight(AMBIENT_COLOUR, 0x444444, 0.5);
    scene.add(hemisphereLight);

    // player marker to show in the minimap
    var markerGeometry = new THREE.CylinderGeometry(10, 10, 5, 10);
    var markerMaterial = new THREE.MeshBasicMaterial({ color: RED_COLOUR });
    playerDot = new THREE.Mesh(markerGeometry, markerMaterial);
    playerDot.rotation.x = Math.PI;
    scene.add(playerDot);

    // player must be at the beginning of the maze
    var startX = (0 - mazeSize / 2) * cellSize + cellSize / 2;
    var startZ = (0 - mazeSize / 2) * cellSize + cellSize / 2;
    playerPosition.set(startX, 20, startZ);
    playerRotation = 0;
    
    camera.position.copy(playerPosition);
    camera.rotation.y = playerRotation;

    // adjust camera to maze size
    var mapSize = (mazeSize * cellSize) / 2 + 50;
    cameraTop.left = -mapSize;
    cameraTop.right = mapSize;
    cameraTop.top = mapSize;
    cameraTop.bottom = -mapSize;
    cameraTop.updateProjectionMatrix();

    // update UI
    var levelElement = document.getElementById('level');
    var animalIconElement = document.getElementById('animalIcon');
    if (levelElement) levelElement.textContent = currentLevel;
    if (animalIconElement) animalIconElement.textContent = currentLevel === 1 ? '🐒' : '🐠';
}

/**
 * Creates 3D walls according to the mazeSize and cells,
 * by checking both top, bottom, left and right
 * created by @MazeCreator
 */
function createWallsFromMaze() {
    // creating walls of the maze
    var wallGeometry = new THREE.BoxGeometry(cellSize, 30, 5);
    var wallTexture = currentLevel === 1 ? createWallTexture('images/wood.jpg') : createWallTexture('images/water_background.jpg');
    var wallMaterial = new THREE.MeshPhongMaterial({
        map: wallTexture
    });

    for (var y = 0; y < mazeSize; y++) {
        for (var x = 0; x < mazeSize; x++) {
            var cell = mazeCreator.maze[y][x];
            var posX = (x - mazeSize / 2) * cellSize + cellSize / 2;
            var posZ = (y - mazeSize / 2) * cellSize + cellSize / 2;
            // HORIZONTAL CELLS
            if (cell.walls.top && y === 0) {
                var wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(posX, 15, posZ - cellSize / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'horizontal' });
            }
            if (cell.walls.bottom) {
                var wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(posX, 15, posZ + cellSize / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'horizontal' });
            }
            // VERTICAL CELLS
            if (cell.walls.left && x === 0) {
                var wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(posX - cellSize / 2, 15, posZ);
                wall.rotation.y = Math.PI / 2;
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'vertical' });
            }
            if (cell.walls.right) {
                var wall = new THREE.Mesh(wallGeometry, wallMaterial);
                wall.position.set(posX + cellSize / 2, 15, posZ);
                wall.rotation.y = Math.PI / 2;
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'vertical' });
            }
        }
    }
}

function createAnimalTexture(model) {
    const loader = new THREE.GLTFLoader();
    loader.load(model,
        function (gltf) {
            var object = gltf.scene;
            
            // calculate position final
            var endX = (mazeSize - 1 - mazeSize / 2) * cellSize + cellSize / 2;
            var endZ = (mazeSize - 1 - mazeSize / 2) * cellSize + cellSize / 2;
            
            // reckon bounding box object
            var boxAnimal = new THREE.Box3().setFromObject(object);
            var size = boxAnimal.getSize(new THREE.Vector3());
            
            var targetSize = 100; 
            var maxDimension = Math.max(size.x, size.y, size.z);
            var scaleFactor = targetSize / maxDimension;
            object.scale.set(scaleFactor, scaleFactor, scaleFactor);
            object.position.set(endX, 5, endZ);
            // rotate to face opposite to wall
            object.rotation.y = Math.PI;
            object.castShadow = true;
            object.receiveShadow = true;
            positionAnimal.set(endX, 5, endZ);
            
            scene.add(object);
            var rotationAnim = { y: Math.PI };
            new TWEEN.Tween(rotationAnim)
                .to({ y: Math.PI + (Math.PI * 2) }, 4000) // rotate 360 degrees in 4 secs
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(function() {
                    object.rotation.y = rotationAnim.y;
                })
                .repeat(Infinity) // repeat all the time
                .start();
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
    );
}

/**
 * 
 * Checks any collisions
 * @param {*} newPos position to check for collisions
 * @param velocity velocity from player
 * @returns 
 */
function checkCollision(newPos, velocity) {
    var collisionDistance = controls.speed + 0.1 + nearPlane;
    // set new player position in direction of move
    raycaster.set(playerPosition, velocity);
    // detect intersections with walls
    const intersects = raycaster.intersectObjects(wallMeshes, false);
    if (intersects.length > 0 && intersects[0].distance < collisionDistance) {
        return true;
    }
    var limit = (mazeSize * cellSize) / 2;
    if (Math.abs(newPos.x) > limit || Math.abs(newPos.z) > limit) {
        return true;
    }
    return false;
}

/**
 * updates player position and minimap
 */
function updatePlayerPosition() {
    var newPos = playerPosition.clone();

    // rotate controls for player
    if (controls.moveLeft) playerRotation += ROTATION_SIDES;
    if (controls.moveRight) playerRotation -= ROTATION_SIDES;

    // go forward or backwards
    if (controls.moveForward) {
        var velocity = new THREE.Vector3(
            -Math.sin(playerRotation),0,-Math.cos(playerRotation)
        );
        newPos.add(velocity.clone().multiplyScalar(controls.speed));
        if (!checkCollision(newPos, velocity)) {
            playerPosition.copy(newPos);
        }
    }
    if (controls.moveBackward) {
        var velocity = new THREE.Vector3(
            -Math.sin(playerRotation),0,-Math.cos(playerRotation)
        );
        newPos.add(velocity.clone().multiplyScalar(-controls.speed));
        if (!checkCollision(newPos, velocity)) {
            playerPosition.copy(newPos);
        }
    }

    // update camera
    camera.position.copy(playerPosition);
    camera.rotation.y = playerRotation;

    // update dot on minimap
    if (playerDot) {
        playerDot.position.set(playerPosition.x, 30, playerPosition.z);
        playerDot.rotation.y = -playerRotation;
    }
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function update() {  
    
    // updat4e stats
    stats.update();
    // update any tweens
    TWEEN.update();
    
    // update player position
    updatePlayerPosition();

    
    // check distance to win
    if (positionAnimal) {
        var distanceToAnimal = playerPosition.distanceTo(positionAnimal);

        if (distanceToAnimal < DISTANCE_TO_END_MAZE) {
            if (currentLevel === 1) {
                console.log("Distancia al final o animal:", distanceToAnimal)
                currentLevel = 2;
                loadScene();
            } else {
                console.log("Distancia al final o animal:", distanceToAnimal)
                document.getElementById('win').style.display = 'block';
            }
        }
    }

    if (controls.currentSizeByLevelMaze !== currentSizeByLevelMaze) {
        currentSizeByLevelMaze = controls.currentSizeByLevelMaze
        restartGame()
    }
}

function restartGame() {
    currentLevel = 1;
    var winDiv = document.getElementById('win');
    if (winDiv) {
        winDiv.style.display = 'none';
    }
    currentSizeByLevelMaze = controls.currentSizeByLevelMaze;
    positionAnimal.set(0, 0, 0)
    loadScene();
}

function render(currentTime) {
    requestAnimationFrame(render);

    if (!lastFrameTime) {
        lastFrameTime = currentTime;
        return;
    }
    // make 60 fps work
    // check time lasted from last frame
    const deltaTime = currentTime - lastFrameTime;
    
    // only render if happened enough time to avoid screen sooner refreshes (60 FPS)
    if (deltaTime < frameInterval) {
        return;
    }
    lastFrameTime += frameInterval;
    // prevents too much lag
    if (deltaTime > frameInterval * 2) {
        lastFrameTime = currentTime;
    }
    
    update();

    // background colour depending on level
    var bacbgroundColour = currentLevel === 1 ? firstLevelColour : secondLevelColour;

    // perspective principal view
    renderer.autoClear = true;
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissor(0, 0, window.innerWidth, window.innerHeight);
    renderer.setScissorTest(false);
    renderer.setClearColor(new THREE.Color(bacbgroundColour));
    renderer.clear();
    renderer.render(scene, camera);

    if (controls.showMinimap) {
        var minimapSize = Math.min(window.innerHeight, window.innerWidth) / 3.5;
        var minimapX = 10;
        var minimapY = 10;
        
        var minimapYCanvas = window.innerHeight - minimapSize - minimapY;
        
        renderer.autoClear = false;
        renderer.setViewport(minimapX, minimapYCanvas, minimapSize, minimapSize);
        renderer.setScissor(minimapX, minimapYCanvas, minimapSize, minimapSize);
        renderer.setScissorTest(true);
        renderer.setClearColor(new THREE.Color(bacbgroundColour));
        renderer.clear();
        renderer.render(scene, cameraTop);
        renderer.setScissorTest(false);
    }
}