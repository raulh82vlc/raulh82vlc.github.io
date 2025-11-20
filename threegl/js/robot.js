/*
 * Copyright (c) 2025 Raul Hernandez Lopez
 *
 * This file is part of the project and is licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License (CC BY-SA 4.0).
 *
 * You are free to share and adapt this file under the terms of the CC BY-SA 4.0 license.
 * Full license: https://creativecommons.org/licenses/by-sa/4.0/legalcode
 */

// grip state to animate
const grip_state = { tightness: 0 };

// global vars
var renderer, scene, camera;
var cameraControls;
var angulo = -0.01;
var robot = new THREE.Object3D();
var finger1, finger2;
var base, arm, forearm, cranes;
// global constants
// opacity
  const opacity_materials = 0.8
const num_nerves = 4
// height disc
const disc_h = 6
// height nerve
const nerve_h = 80
// angles
const rotate_angle_nerves = Math.PI * 2 // 360 degrees
const rotate_angle_centered = Math.PI / 2 // 90 degrees
const rotate_angle_arm = Math.PI / 3

// colour RED
const red_colour = 0xff4444
const material_red = new THREE.MeshBasicMaterial({ color: red_colour, transparent: true, opacity: opacity_materials });

// GUI
const controls = {
    angle_y_base: 0,
    angle_z_arm: 0,
    angle_y_forearm: 0,
    angle_z_forearm: 0,
    angle_z_crane: 0,
    separation_fingers: 10,
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    wireframe: false,
    animation: false,
    speed: 0.35,
};

var isAnimated = false
var animationTime = 0
var clock = new THREE.Clock();

// resources monitor
const stats = new Stats();

// Event listeners para controles
document.addEventListener('keydown', (event) => {
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

// Event listeners para controles
document.addEventListener('keyup', (event) => {
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


// 3-renderiza
render();

function setGUI() {
  var gui = new dat.GUI({ width: 325 });
  // ROBOT options
  var gui_robot = gui.addFolder('Control Robot');
  gui_robot.add(controls, 'angle_y_base', -180, 180).name("Giro Base").listen();
  gui_robot.add(controls, 'angle_z_arm', -45, 45).name("Giro Brazo").listen();
  gui_robot.add(controls, 'angle_y_forearm', -180, 180).name("Giro Antebrazo Y").listen();
  gui_robot.add(controls, 'angle_z_forearm', -90, 90).name("Giro Antebrazo Z").listen();
  gui_robot.add(controls, 'angle_z_crane', -40, 220).name("Giro Pinza").listen();
  gui_robot.add(controls, 'separation_fingers', 0, 15)
  .name("Separación Pinza")
  .listen()
  .onChange(function(value) {
    animateGrip(value); 
  });
  
  // alambrico - wireframe
  gui.add(controls, 'wireframe').name('Alambres').onChange(function(value) {
    updateWireframe(value);
  });
  // animation button
  gui.add({animate: animateRobot}, 'animate').name('Anima');
  gui_robot.open();
}

function updateRobotPosition() {
  if (controls.moveForward) {
    robot.position.z -= controls.speed;
  }
  if (controls.moveBackward) {
    robot.position.z += controls.speed;
  }
  if (controls.moveLeft) {
    robot.position.x -= controls.speed;
  }
  if (controls.moveRight) {
    robot.position.x += controls.speed;
  }
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

function init()
{
  renderer = new THREE.WebGLRenderer();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setClearColor( new THREE.Color(0xFFFFFF) );
  document.getElementById('container').appendChild( renderer.domElement );
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();

  var aspectRatio = window.innerWidth / window.innerHeight;
  camera = new THREE.PerspectiveCamera( 50, aspectRatio , 0.1, 1000 );
  camera.position.set( 150, 100, 150);

  cameraControls = new THREE.OrbitControls( camera, renderer.domElement );
  cameraControls.target.set( 0, 0, 0 );
  
  var ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);
  var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  scene.add(directionalLight);

  window.addEventListener('resize', updateAspectRatio );
  // FPS
  stats.showPanel(0);	
	document.getElementById( 'container' ).appendChild( stats.domElement );
}

function loadScene()
{ 
  // CONSTANTS
  // granular variables
  const base_radius = 50
  const base_h = 15
  const asparragus_radius = 20
  const hand_radius = 15
  const asparragus_height_segments = 18
  // axis constants
  const axis_width = 18
  const axis_height = 120
  const axis_segments = 12
  const radial_segments = 32
  const radial_sparragus = 16
  const floor_dimension = 1000
  const hand_h = 40
  
  // kneecap constants
  const radius_sphere_kneecap = 20
  const kneecap_h_segments_width_segments  = 32
  const kneecap_h_segments = 16
  // disc
  const disc_radius = 22

  // positions changes
  const position_y_axis = axis_height / 2
  const position_y_kneecap = axis_height
  // colours
  // YELLOW
  const yellow_colour = 0xffff00
  // BLUE
  const blue_colour = 0x0000ff
  // GREY
  const floor_colour = 0x0000ff
  // GREEN
  const green_colour = 0x00ff00
  
  // geometries
  let floor_geometry = new THREE.PlaneGeometry(floor_dimension, floor_dimension);
  // materials
  let floor_material = new THREE.MeshLambertMaterial({ color: floor_colour, transparent: true, opacity: opacity_materials })
  let green_material = new THREE.MeshBasicMaterial({ color: green_colour, transparent: true, opacity: opacity_materials });
  let yellow_material = new THREE.MeshBasicMaterial({ color: yellow_colour, transparent: true, opacity: opacity_materials });

  // FLOOR IN XZ
  let floor = new THREE.Mesh(floor_geometry, floor_material);
  floor.rotation.x = -rotate_angle_centered;
  floor.receiveShadow = true;
  scene.add(floor);

  // ROBOT
  scene.add(robot);

  // ROBOT BASE
  base = new THREE.Object3D();
  let base_mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(base_radius, base_radius, base_h, radial_segments),
    green_material
  );
  base.position.y = base_h / 2;
  base.add(base_mesh);
  robot.add(base);
  
  // ARM
  arm = new THREE.Object3D();
  arm.position.set(0, base_h, 0); // on top of base
  base.add(arm);
  // AXIS FROM ARM
  let axis = new THREE.Mesh(
    new THREE.BoxGeometry(axis_width, axis_height, axis_segments),
    material_red
  );
  axis.castShadow = true;
  axis.position.set(0, position_y_axis, 0); // center vertical position
  arm.add(axis);
  
  const material_blue = new THREE.MeshBasicMaterial({ color: blue_colour, transparent: true, opacity: opacity_materials });
  // ASPARRAGUS (POLEA)
  let asparragus = new THREE.Mesh(
    new THREE.CylinderGeometry(asparragus_radius, asparragus_radius, asparragus_height_segments, radial_sparragus),
    material_blue
  );

  asparragus.rotateOnAxis(new THREE.Vector3(0, 0, 1), rotate_angle_centered);
  arm.add(asparragus);
  
  // KNEECAP (ROTULA)
  const geometry_rotula = new THREE.SphereGeometry(radius_sphere_kneecap, kneecap_h_segments_width_segments, kneecap_h_segments ); 
  const material = new THREE.MeshBasicMaterial( { color:  yellow_colour } ); 
  let sphere_kneecap = new THREE.Mesh( geometry_rotula , material );
  sphere_kneecap.position.set(0, position_y_kneecap, 0); // center vertical position
  arm.add(sphere_kneecap);
  

  // FOREARM (ANTEBRAZO)
  forearm = new THREE.Object3D();
  forearm.position.set(0, position_y_kneecap, 0); // on top of kneecap
  arm.add(forearm);
  arm.rotation.x = -rotate_angle_arm;

  // DISC on top of kneecap
  let disc = new THREE.Mesh(
    new THREE.CylinderGeometry(disc_radius, disc_radius, disc_h, radial_segments),
    material_red
  );
  disc.position.set(0, disc_h / 2, 0);
  forearm.add(disc);
   
  // FOREARM NERVES
  let nerves = createForeArmNerves();
  for(let i = 0; i < num_nerves; i++) {
    forearm.add(nerves[i]);
  }

  // HAND (radius 15, height 40)
  let hand = new THREE.Mesh(
    new THREE.CylinderGeometry(hand_radius, hand_radius, hand_h, radial_segments),
    yellow_material
  );
  hand.position.y = disc_h + nerve_h + (hand_h / 4); // on top of nerves
  hand.rotation.z = rotate_angle_centered;
  hand.castShadow = true;
  forearm.add(hand);

  // CRANES (PINZAS)
  cranes = new THREE.Object3D();
  let crane_material = new THREE.MeshBasicMaterial({ color: red_colour, transparent: true, opacity: opacity_materials });
  cranes.position.y = nerve_h + disc_h + (hand_h / 2); // on top of

  forearm.add(cranes);

  // FINGERS
  createGrippingFingers(cranes, crane_material, grip_tightness = 0.5)
}

/**
 * Creates a gripping fingers effect
 * @param {*} cranes crane to add each finger
 * @param {*} crane_material material of the crane
 * @param {*} grip_tightness from 0 (fully closed fingers) to 1 (fully open fingers)
 */
function createGrippingFingers(cranes, crane_material, grip_tightness = 0.2) {
  // transformation 1 rotate x to the center -rotate_angle_centered
  // transformation 3 rotate z to the direction of the robot
  const angle_looks_opposite = Math.PI / 2
  const angle_variants = getClosingAngle(grip_tightness, controls.separation_fingers)

  finger1 = new THREE.Mesh(
    createCraneFinger(),
    crane_material
  );
  
  setFinger(finger1, angle_variants.finger_distance, -rotate_angle_centered, -angle_variants.closing_angle, angle_looks_opposite, cranes);

  finger2 = new THREE.Mesh(
    createCraneFinger(),
    crane_material
  );

  setFinger(finger2, -angle_variants.finger_distance, -rotate_angle_centered, angle_variants.closing_angle, angle_looks_opposite, cranes);
}

function getClosingAngle(grip_tightness = 0.2, threshold) {
  const max_closing_angle = Math.PI / 6; // 30 degrees max of closure
  const finger_threshold = threshold;
  
  // adjust finger distance by open to close of the gripping fingers
  const finger_distance = finger_threshold * (1 - grip_tightness * 0.5);
  // rotate y position in an angle like catching something by the crane
  return {
    finger_distance: finger_distance,
    closing_angle: max_closing_angle * grip_tightness
  };
}

/**
 * Sets finger and its transformations
 * @param {*} finger finger object
 * @param {*} finger_threshold distance betwen fingers
 * @param {*} zero_rotation  rotate to the center by x axis
 * @param {*} first_rotation  rotate to the y axis to make catching effect
 * @param {*} second_rotation  rotate z axis to look to the opposite front direction like the robot
 * @param {*} cranes cranes to add finger
 */
function setFinger(finger, finger_threshold, zero_rotation, first_rotation, second_rotation, cranes) {
  finger.position.x = finger_threshold; // position each finger in parallel
  finger.rotation.x = zero_rotation; // point to same direction than nerves and arm
  finger.rotation.y = first_rotation; // angle to catch an object effect
  finger.rotation.z = second_rotation; // rotate to make crane direction to the same of the robot
  finger.castShadow = true;
  cranes.add(finger);
}

// Creates of crane vertices and indexes to render into a BufferGeometry
// it's a wedge-shaped
function createCraneFinger() {
  var geometry = new THREE.BufferGeometry();
  
  // Vertices of pyramidal fingers with wedge-shape (measures: width: 20 x height: 4)
  var vertices = new Float32Array([
    // Rectangular base to catch objets in crane (z=0), from 0 to 3rd vertex
    -10, -2, 0, // 0 back -> left -> bottom
    10, -2, 0,  // 1st back -> right -> bottom
     10,  2, 0, // 2nd front -> right -> bottom
    -10,  2, 0, // 3rd front -> left -> bottom
    
    // Upper base to catch objects in crane (z=2), from 4th to 7th vertex
    -10, -2, 2, // back -> left / slightly upper or raised level
     10, -2, 2, // back -> right / bottom level
     10,  2, 2, // front -> right / bottom level
    -10,  2, 2, // front -> left / bottom level
    
    // Edge of the crane (z=38, centered), from 8th to 11th vertex
    -10, -1, 38, // upper thin border / back -> left edge
    -10, 1, 38, // lower thin border / front -> left edge
     10, -1, 38, // back -> right edge
     10, 1, 38, // front -> right edge
  ]);
  
  // Indexes to shape its figure
  var indexes = new Uint16Array([
    // Lower base, face 1 (z = 0)
    0, 3, 2,  0, 2, 1,
    // Upper base to catch (beginning of pyramid), face 2 (z=2)
    4, 5, 6,  4, 6, 7,
    // Sides
    0, 1, 5,  0, 5, 4, // opposite face
    1, 2, 6,  1, 6, 5, // right face
    2, 3, 7,  2, 7, 6, // back face
    3, 0, 4,  3, 4, 7, // left face
    // Faces of crane, pyramid shapes
    4, 5, 10, 4, 10, 8, // upper face
    6, 7, 9, 6, 9, 11, // lower face
    5, 6, 11, 5, 11, 10, // right face
    7, 4, 8, 7, 8, 9, // left face
    // End edge of the crane
    8, 10, 11, 8, 11, 9 // opposite face from the corner
  ]);
  
  geometry.setIndex(new THREE.BufferAttribute(indexes, 1));
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); // Normal calculation
  
  return geometry;
}

// Creates forearm nerves to the arm
// Each nerve is distributed at 90 degrees around the circle
// where angle = (rotate_angle_nerves * i) / num_nerves; this gives:
// i = 0 => angle 360 * 0 / 4 = 0 degrees
// i = 1 => angle 360 * 1 / 4 = 90 degrees
// i = 2 => angle 360 * 2 / 4 = 180 degrees
// i = 4 => angle 360 * 3 / 4 = 270 degrees
function createForeArmNerves() {
  const nerve_depth = 4
  // nerve width
  const nerve_w = 4
  const nerve_distance = 10
  
  let nerves = [];
  for(let i = 0; i < num_nerves; i++) {
    let nerve = new THREE.Mesh(
      new THREE.BoxGeometry(
        nerve_w, nerve_h, nerve_depth
      ),
      material_red
    )
    let angle = (rotate_angle_nerves * i) / num_nerves;
   
    // for x: cos(0) * 10 = 10; for z: sin(0) * 10 = 0
    // for x: cos(90) * 10 = 0; for z: sin(90) * 10 = 10
    // for x: cos(180) * 10 = -10; for z: sin(190) * 10 = 0
    // for x: cos(270) * 10 = 0; for z: sin(270) * 10 = -10
    nerve.position.x = Math.cos(angle) * nerve_distance;
    // on top of origin, y = 6 + (80/2) = 46
    nerve.position.y = disc_h + (nerve_h / 2); // on top of disc
    nerve.position.z = Math.sin(angle) * nerve_distance;
    nerve.castShadow = true;
    nerves[i] = nerve;
  }
  return nerves;
}

function updateAspectRatio()
{
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function update()
{
  var delta = clock.getDelta();
  // Cambios para actualizar la camara segun mvto del raton
  cameraControls.update();
  stats.update();
  
  updateRobotPosition();
  
  // update animation if active
  updateAnimation(delta);
  
  // do rotations from GUI
  base.rotation.y = controls.angle_y_base * Math.PI / 180;
  arm.rotation.x = controls.angle_z_arm * Math.PI / 180;
  forearm.rotation.y = controls.angle_y_forearm * Math.PI / 180;
  forearm.rotation.z = controls.angle_z_forearm * Math.PI / 180;
  cranes.rotation.x = controls.angle_z_crane * Math.PI / 180;
  // cranes separation
  separation_fingers = controls.separation_fingers
  const angle_variants = getClosingAngle(grip_state.tightness, separation_fingers)
  finger1.rotation.y = -angle_variants.closing_angle;
  finger2.rotation.y = angle_variants.closing_angle; 
}

function animateGrip(target_separation) {
  const target_tightness = 1 - (target_separation / 15);

  new TWEEN.Tween(grip_state)
    .to({ tightness: target_tightness }, 1000) // animate each second
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();
}

function animateRobot() {
  if (isAnimated) {
    console.log("Robot animado en marcha...");
    return;
  }
  
  isAnimated = true;
  animationTime = 0;
}

function updateAnimation(delta) {
  if (!isAnimated) return;
  
  animationTime += delta;
  
  // sample animation in 10 seconds
  const cycle = animationTime % 10;
  
  if (cycle < 2) {
    // rotate base (0-2 seconds)
    controls.angle_y_base = Math.sin(animationTime * 2) * 90;
  } else if (cycle < 4) {
    // move arms (2-4 secs)
    controls.angle_z_arm = Math.sin(animationTime * 2) * 30;
  } else if (cycle < 6) {
    // move forearm (4-6 secs)
    controls.angle_y_forearm = Math.sin(animationTime * 2) * 90;
  } else if (cycle < 8) {
    // move forearm Z (6-8 secs)
    controls.angle_z_forearm = Math.sin(animationTime * 2) * 45;
  } else {
    // open and close crane (8-10 secs)
    controls.separation_fingers = (Math.sin(animationTime * 4) + 1) * 7.5;
  }
  
  // stop after 10 secs
  if (animationTime > 10) {
    isAnimated = false;
    animationTime = 0;
    console.log("Animación completada");
  }
}

function render()
{
	requestAnimationFrame( render );
  TWEEN.update();
	update();
	renderer.render( scene, camera );
}