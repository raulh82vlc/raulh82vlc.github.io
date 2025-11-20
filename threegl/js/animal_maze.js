/*
 * Copyright (c) 2025 Raul Hernandez Lopez
 *
 * This file is part of the project and is licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0).
 *
 * You are free to share and adapt this file under the terms of the CC BY-SA 4.0 license.
 * Full license: https://creativecommons.org/licenses/by-sa/4.0/legalcode
 */

// global vars and constants
const nearPlane = 0.1;
const DEFAULT_SIZE_MAZE = 10;
const RED_COLOUR = 0xFF0000;
const DISTANCE_TO_END_MAZE = 40;
const ROTATION_SIDES = 0.03;
const AMBIENT_COLOUR = 0xffffff;
const GOLDEN_COLOUR ='#FFD700'
const ORANGE_COLOUR = 0xFF6600
const BLUE_COLOUR = 0x00BFFF
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
var soundTrack = null;
var audioStarted = false;
// added skybox to fix the bug, now it changes depending on position of the player
var skybox = null;
var sphere = null; // same for sphere to make it not visible on screen
// collected items, coral in level 2, bananas in level 1
var collectedItems = []; // collected items
var collectedItemsMeshes = []; // collected items meshes
var numCollectedItems = 0;
// sprite is to render the number of collected items on screen
var textSpriteToRender = null;
// torches
var lightTorches = []; // new lights

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
    if (!audioStarted && soundTrack) {
        soundTrack.play();
        audioStarted = true;
    }
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
    collectedItems = []; // collected items
    collectedItemsMeshes = []; // collected items meshes
    numCollectedItems = 0;
    lightTorches = []; // new lights


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
        createAudioTrack('audio/jungle-forest.mp3')
    } else {
        // fish
        createAnimalTexture('models/shiny_fish/scene.gltf')
        createAudioTrack('audio/under-the-sea.mp3')
    }
    
    const cubeTextureLoader = new THREE.CubeTextureLoader();
    var cubemap = cubeTextureLoader.load([
        'skybox/phobos_lf.jpg', 
        'skybox/phobos_rt.jpg', 
        'skybox/phobos_up.jpg', 
        'skybox/phobos_dn.jpg', 
        'skybox/phobos_ft.jpg',  
        'skybox/phobos_bk.jpg' 
    ], 
        function (texture) {
            console.log('Cubemap loaded.');
            scene.background = cubemap;
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

    cubeTextureLoader.load([
        'skybox/phobos_lf.jpg', 
        'skybox/phobos_rt.jpg', 
        'skybox/phobos_up.jpg', 
        'skybox/phobos_dn.jpg', 
        'skybox/phobos_ft.jpg',  
        'skybox/phobos_bk.jpg' 
    ], 
        function (cubemapForSphere) {
            // create a reflect material
            const sphereGeometry = new THREE.SphereGeometry(5, 64, 64);
            const reflectiveMaterial = new THREE.MeshPhongMaterial({
                envMap: cubemapForSphere, // use el cubemap to reflect
                metalness: 1.0,
                roughness: 0.1
            });
            sphere = new THREE.Mesh(sphereGeometry, reflectiveMaterial);
            sphere.position.set(0, 0, 0); // Posicionar la esfera
            scene.castShadow = true;
            scene.add(sphere);
        }, 
        undefined, 
        function (error) {
            console.error('Error loading cubemap', error);
        }
    );

    const skyboxGeometry = new THREE.BoxGeometry(800, 800, 800); // big cube
    skybox = new THREE.Mesh(skyboxGeometry, materials);
    skybox.position.set(playerPosition.x,
            playerPosition.y,
            playerPosition.z);
    skybox.updateMatrix();
    skybox.updateMatrixWorld();
    if (sphere) {
        sphere.position.set(playerPosition.x,
            playerPosition.y,
            playerPosition.z);
    }
    scene.add(skybox);

    // ambient light
    var ambientLight = new THREE.AmbientLight(AMBIENT_COLOUR, 0.5); // reduced ambient light to give torches light more significant value, from 0.7 to 0.5
    scene.add(ambientLight);

    var directionalLight = new THREE.DirectionalLight(AMBIENT_COLOUR, 0.8); // reducing directional light too from 1 to 0.8
    directionalLight.position.set(100, 200, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -500;
    directionalLight.shadow.camera.right = 500;
    directionalLight.shadow.camera.top = 500;
    directionalLight.shadow.camera.bottom = -500;
    directionalLight.shadow.camera.far = 1000;
    scene.add(directionalLight);

    var hemisphereLight = new THREE.HemisphereLight(AMBIENT_COLOUR, 0x444444, 0.3); // reduced from 0.5 to 0.2 too
    scene.add(hemisphereLight);
    addLightTorches();
    addCollectedItems();

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

    updateUIWithNewObjects();
}

function updateUIWithNewObjects() {
    var levelElement = document.getElementById('level');
    var animalIconElement = document.getElementById('animalIcon');
    if (levelElement) levelElement.textContent = currentLevel;
    if (animalIconElement) animalIconElement.textContent = currentLevel === 1 ? '🐒' : '🐠';
    
    // update counter
    updateCollectedItemsText();
}

function createText(text) {
    // canvas
    var canvas = document.createElement('canvas');
    // 2d context
    var context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    // almost alpha equal to 0
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // gold colour
    context.strokeStyle = GOLDEN_COLOUR;
    context.lineWidth = 4;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    
    // text features
    context.font = 'bold 38px Arial';
    context.fillStyle = GOLDEN_COLOUR;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // texture for canvas
    var texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    // create sprite for text
    var spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    var spriteToRender = new THREE.Sprite(spriteMaterial);
    spriteToRender.scale.set(16, 4, 1); // sprite size
    return spriteToRender;
}

/**
 * collected items multi purpose
 * 1) clean up
 * 2) render icon and counter with text
 * 3) refresh with position besides player
 * 4) render sprite with counter again
 */
function updateCollectedItemsText() {
    if (textSpriteToRender) {
        scene.remove(textSpriteToRender);
        if (textSpriteToRender.material.map) textSpriteToRender.material.map.dispose();
        if (textSpriteToRender.material) textSpriteToRender.material.dispose();
    }
    var icon = currentLevel === 1 ? '🍌' : '🪸';
    var text = icon + ' ' + numCollectedItems + '/' + collectedItems.length;
    textSpriteToRender = createText(text);
    if (textSpriteToRender) {
        updateTextSprinteContent();
        scene.add(textSpriteToRender);
    }
}

function addCollectedItems() {
    // only 50% of collected items if so
    var numCollectedItems = Math.floor(mazeSize * 0.5);
    
    for (var i = 0; i < numCollectedItems; i++) {
        // random position
        var x = Math.floor(Math.random() * mazeSize);
        var y = Math.floor(Math.random() * mazeSize);
        
        // remove first and last position of the maze
        if ((x === 0 && y === 0) || (x === mazeSize - 1 && y === mazeSize - 1)) {
            continue;
        }
        // items appear right in the middle of the maze
        var posX = (x - mazeSize / 2) * cellSize + cellSize / 2;
        var posZ = (y - mazeSize / 2) * cellSize + cellSize / 2;
        // either banana or coral for second level
        const collectedItemTexture = currentLevel === 1 ? 'models/banana/scene.gltf' : 'models/coral/scene.gltf';
        createCollectedItemTexture(collectedItemTexture, posX, posZ)
    }
}

// adds torches with light
function addLightTorches() {
    // number up to 50% chances
    var numLights = Math.floor(mazeSize * 0.50);
    var wallIndices = [];
    for (var i = 0; i < walls.length; i++) {
        wallIndices.push(i);
    }
    wallIndices.sort(function() { return 0.5 - Math.random(); });
    for (var i = 0; i < numLights && i < wallIndices.length; i++) {

        var wall = walls[wallIndices[i]];

        var posX = wall.pos.x;
        var posY = 15; // fixed initial posY
        var posZ = wall.pos.z;

        var offset = 6; // small offset
        // add to when direction horizontal
        if (wall.direction === 'horizontal') {
            // north or south
            if (wall.pos.z < 0) {
                posZ += offset; // wall north
            } else {
                posZ -= offset; // south
            }
        } else {
            if (wall.pos.x < 0) {
                posX += offset; // wall west
            } else {
                posX -= offset; // east
            }
        }
        
        // point light for torch
        var pointlight = new THREE.PointLight(
            currentLevel === 1 ? ORANGE_COLOUR : BLUE_COLOUR,
            2.6,
            100,
            2
        );
        pointlight.position.set(posX, posY + offset * 2, posZ);
        pointlight.castShadow = true;
        scene.add(pointlight);
        
        // torch model
        createFlameTexture('models/torch/scene.gltf', posX, posY - offset, posZ)

        // flicker ilumination for flame
        var flickerAnim = { intensity: 1.5 };
        new TWEEN.Tween(flickerAnim)
            .to({ intensity: 1.0 }, 200)
            .easing(TWEEN.Easing.Quadratic.InOut)
            .onUpdate(function() {
                pointlight.intensity = flickerAnim.intensity;
            })
            .yoyo(true)
            .repeat(Infinity)
            .start();
        lightTorches.push({ light: pointlight });
    }
}

/**
 * adds items that will be collected while playing
 */
function addItemsCollected() {
    var collectionDistance = 15;
    for (var i = 0; i < collectedItems.length; i++) {
        var collectedItem = collectedItems[i];
        if (!collectedItem.collected) {
            var distance = playerPosition.distanceTo(collectedItem.mesh.position);
            
            if (distance < collectionDistance) {
                // add collected item
                collectedItem.collected = true;
                numCollectedItems++;
                
                var meshToRemove = collectedItem.mesh;
                // animation when collected, makes it smaller
                var scaleDown = { scale: 1 };
                new TWEEN.Tween(scaleDown)
                    .to({ scale: 0 }, 400)
                    .easing(TWEEN.Easing.Back.In)
                    .onUpdate(function() {
                        meshToRemove.scale.set(scaleDown.scale, scaleDown.scale, scaleDown.scale);
                    })
                    .onComplete(function() {
                        // remove item from mesh once collected
                        scene.remove(meshToRemove);
                        if (meshToRemove.geometry) meshToRemove.geometry.dispose();
                        if (meshToRemove.material && meshToRemove.material.map) {
                            meshToRemove.material.map.dispose();
                            meshToRemove.material.dispose();
                        }
                    })
                    .start();
                
                // update new collectedItems
                updateUIWithNewObjects();
                break;
            }
        }
    }
}

/**
 * Creates 3D walls according to the mazeSize and cells,
 * by checking both top, bottom, left and right
 * created by @MazeCreator
 */
function createWallsFromMaze() {
    // creating walls of the maze
    var wallTexture = currentLevel === 1 ? createWallTexture('images/wood.jpg') : createWallTexture('images/water_background.jpg');
    var wallMaterial = new THREE.MeshPhongMaterial({
        map: wallTexture
    });
    // random new heights
    var wallHeights = [20, 25, 30, 35, 40, 45];
    var wallTextures = [];
    if (currentLevel === 1) {
        // new mix of textures for walls
        wallTextures = [
            createWallTexture('images/wood.jpg'),
            createWallTexture('images/stone.jpg'),
              createWallTexture('images/stone2.jpg')
        ];
    } else {
        // new mix of textures for walls
        wallTextures = [
            createWallTexture('images/water_background.jpg'),
            createWallTexture('images/sea2.jpg'),
            createWallTexture('images/water-rock.jpg')
        ];
    }
    for (var y = 0; y < mazeSize; y++) {
        for (var x = 0; x < mazeSize; x++) {
            var cell = mazeCreator.maze[y][x];
            var posX = (x - mazeSize / 2) * cellSize + cellSize / 2;
            var posZ = (y - mazeSize / 2) * cellSize + cellSize / 2;
            // select random textures for each wall
            var wallTexture = wallTextures[Math.floor(Math.random() * wallTextures.length)];
            
            var wallMaterial = new THREE.MeshPhongMaterial({
                map: wallTexture
            });
            // HORIZONTAL CELLS
            if (cell.walls.top && y === 0) {
                var wallHeightTop = wallHeights[Math.floor(Math.random() * wallHeights.length)];
                var wallGeometryTop = new THREE.BoxGeometry(cellSize, wallHeightTop, 5);
                var wall = new THREE.Mesh(wallGeometryTop, wallMaterial);
                wall.position.set(posX, wallHeightTop / 2, posZ - cellSize / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'horizontal' });
            }
            if (cell.walls.bottom) {
                var wallHeightBottom = wallHeights[Math.floor(Math.random() * wallHeights.length)];
                var wallGeometryBottom = new THREE.BoxGeometry(cellSize, wallHeightBottom, 5);
                var wall = new THREE.Mesh(wallGeometryBottom, wallMaterial);
                wall.position.set(posX, wallHeightBottom / 2, posZ + cellSize / 2);
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'horizontal' });
            }
            // VERTICAL CELLS
            if (cell.walls.left && x === 0) {
                var wallHeightLeft = wallHeights[Math.floor(Math.random() * wallHeights.length)];
                var wallGeometryLeft = new THREE.BoxGeometry(cellSize, wallHeightLeft, 5);
                var wall = new THREE.Mesh(wallGeometryLeft, wallMaterial);
                wall.position.set(posX - cellSize / 2, wallHeightLeft / 2, posZ);
                wall.rotation.y = Math.PI / 2;
                wall.castShadow = true;
                wall.receiveShadow = true;
                scene.add(wall);
                wallMeshes.push(wall);
                walls.push({ pos: wall.position, direction: 'vertical' });
            }
            if (cell.walls.right) {
                var wallHeightRight = wallHeights[Math.floor(Math.random() * wallHeights.length)];
                var wallGeometryRight = new THREE.BoxGeometry(cellSize, wallHeightRight, 5);
                var wall = new THREE.Mesh(wallGeometryRight, wallMaterial);
                wall.position.set(posX + cellSize / 2, wallHeightRight / 2, posZ);
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
            offsetEndMaze = 30
            // calculate position final
            var endX = ((mazeSize - 1 - mazeSize / 2) * cellSize + cellSize / 2) - offsetEndMaze;
            var endZ = ((mazeSize - 1 - mazeSize / 2) * cellSize + cellSize / 2) - offsetEndMaze;
            
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
            positionAnimal.set(endX, 2, endZ);
            
            scene.add(object);
            var rotationAnim = { x: Math.PI };
            new TWEEN.Tween(rotationAnim)
                .to({ x: -Math.PI + (-Math.PI * 2) }, 4000) // rotate 360 degrees in 4 secs
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(function() {
                    object.rotation.x = rotationAnim.x;
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

function createCollectedItemTexture(model, positionX, positionZ) {
    const loader = new THREE.GLTFLoader();
    loader.load(model,
        function (gltf) {
            var object = gltf.scene;
            
            // reckon bounding box object
            var box = new THREE.Box3().setFromObject(object);
            var size = box.getSize(new THREE.Vector3());
            
            var targetSize = 50; 
            var maxDimension = Math.max(size.x, size.y, size.z);
            var scaleFactor = targetSize / maxDimension;
            object.scale.set(scaleFactor, scaleFactor, scaleFactor);
            object.position.set(positionX, 20, positionZ);
            // rotate to face opposite to wall
            // object.rotation.y = Math.PI;
            object.castShadow = true;
            object.receiveShadow = true;

            // rotate animation
            var rotationAnimation = { y: 0 };
            new TWEEN.Tween(rotationAnimation)
                .to({ y: Math.PI * 2 }, 2000) // 2 secs rotation
                .easing(TWEEN.Easing.Linear.None)
                .onUpdate(function() {
                    object.rotation.y = rotationAnimation.y;
                })
                .repeat(Infinity) // repetir todo el tiempo
                .start();
            
            // floating animation
            var floatingAnimation = { y: 20 };
            new TWEEN.Tween(floatingAnimation)
                .to({ y: 15 }, 1000)
                .easing(TWEEN.Easing.Quadratic.InOut)
                .onUpdate(function() {
                    object.position.y = floatingAnimation.y;
                })
                .yoyo(true)
                .repeat(Infinity)
                .start();

            scene.add(object);
            
            collectedItems.push({ mesh: object, collected: false });
            collectedItemsMeshes.push(object);
            updateCollectedItemsText();
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
    );
}

function createFlameTexture(model, positionX, positionY, positionZ) {
    const loader = new THREE.GLTFLoader();
    loader.load(model,
        function (gltf) {
            var object = gltf.scene;
            
            // reckon bounding box object
            var box = new THREE.Box3().setFromObject(object);
            var size = box.getSize(new THREE.Vector3());
            
            var targetSize = 20; 
            var maxDimension = Math.max(size.x, size.y, size.z);
            var scaleFactor = targetSize / maxDimension;
            object.scale.set(scaleFactor, scaleFactor, scaleFactor);
            object.position.set(positionX, positionY, positionZ);
            
            object.castShadow = true;
            object.receiveShadow = true;

            scene.add(object);
    },
    (xhr) => {
        console.log((xhr.loaded / xhr.total) * 100 + '% loaded')
    },
    (error) => {
        console.log(error)
    }
    );
}

function createAudioTrack(file) {
    if (soundTrack) {
        if (soundTrack.isPlaying) {
            soundTrack.stop();
        }
        // disconnect listener
        if (soundTrack.source) {
            soundTrack.disconnect();
        }
    }
    
    const listener = new THREE.AudioListener();
    camera.add(listener);
    // create a global audio source
    soundTrack = new THREE.Audio( listener );

    // load a sound and set it as the Audio object's buffer
    const audioLoader = new THREE.AudioLoader();
    audioLoader.load(file, function( buffer ) {
        soundTrack.setBuffer( buffer );
        soundTrack.setLoop( true );
        soundTrack.setVolume( 0.5 );
        // if already connected, play
        if (audioStarted) {
            soundTrack.play();
        }
    },
    function(xhr) {
        console.log((xhr.loaded / xhr.total * 100) + '% cargado audio');
    },
    function(error) {
        console.error('Error cargando audio:', error);
    });
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
    
    if (skybox) {
        skybox.position.set(playerPosition.x,
            playerPosition.y,
            playerPosition.z);
        sphere.position.set(playerPosition.x,
            playerPosition.y,
            playerPosition.z);
        skybox.updateMatrix();
        skybox.updateMatrixWorld(); 
        // console.log('skybox after player update position x:', skybox.position.x, ' y:', skybox.position.y, skybox.position.y, ' z:', skybox.position.z)
    }

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
    updateTextSprinteContent();

    addItemsCollected();
    
    // check distance to win
    if (positionAnimal) {
        var distanceToAnimal = playerPosition.distanceTo(positionAnimal);

        if (distanceToAnimal < DISTANCE_TO_END_MAZE) {
            console.log("Distancia al final del laberinto o animal:", distanceToAnimal)
            if (soundTrack && soundTrack.isPlaying) {
                soundTrack.stop();
            }
            if (currentLevel === 1) {   
                currentLevel = 2;
                loadScene();
            } else {
                document.getElementById('win').style.display = 'block';
            }
        }
    }

    if (controls.currentSizeByLevelMaze !== currentSizeByLevelMaze) {
        currentSizeByLevelMaze = controls.currentSizeByLevelMaze
        restartGame()
    }
}

function updateTextSprinteContent() {
    if (textSpriteToRender) {
        
        const forward = 25;  // forward our camera position
        const right = 25;    // rigth side
        const down = -16;     // bottom
        const dirX = -Math.sin(playerRotation);
        const dirZ = -Math.cos(playerRotation);
        const rightX = -dirZ;
        const rightZ = dirX;
        
        // reckon bottom right position from camera
        textSpriteToRender.position.set(
            playerPosition.x + (dirX * forward) + (rightX * right),
            playerPosition.y + down,
            playerPosition.z + (dirZ * forward) + (rightZ * right)
        );
    }
}

function restartGame() {
    currentLevel = 1;
    numCollectedItems = 0;
    
    if (audioStarted && soundTrack) {
        try {
            // stop previous sound
            soundTrack.stop();
        } catch (e) {
            console.warn("Error al detener audio:", e);
        }
    }
    audioStarted = false;
    var winDiv = document.getElementById('win');
    if (winDiv) {
        // close div once won
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