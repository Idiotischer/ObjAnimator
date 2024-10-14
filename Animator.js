let scene, camera, renderer, controls;
let objModel, selectedObject;
let animationData = {};
let materialMode = 'shaded';
let currentFrame = 0;
let totalFrames = 120;
let isAnimating = false;

const materialsMap = new Map();

const timelineCanvas = document.createElement('canvas');
const timelineContext = timelineCanvas.getContext('2d');
timelineCanvas.width = window.innerWidth - 20;
timelineCanvas.height = 50;
document.body.appendChild(timelineCanvas);

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    const light = new THREE.AmbientLight(0x404040);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    controls = new THREE.OrbitControls(camera, renderer.domElement);

    loadModelWithMaterial();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const dropArea = document.createElement('div');
    dropArea.id = 'dropArea';
    dropArea.style.position = 'fixed';
    dropArea.style.bottom = '20px';
    dropArea.style.right = '20px';
    dropArea.style.width = '200px';
    dropArea.style.height = '100px';
    dropArea.style.border = '2px dashed #ccc';
    dropArea.style.display = 'flex';
    dropArea.style.alignItems = 'center';
    dropArea.style.justifyContent = 'center';
    dropArea.style.color = '#666';
    dropArea.style.fontSize = '16px';
    dropArea.style.textAlign = 'center';
    dropArea.innerText = 'Drop your .obj and .mtl files here';
    document.body.appendChild(dropArea);

    dropArea.addEventListener('dragover', (event) => {
        event.preventDefault();
        dropArea.style.backgroundColor = '#f0f0f0';
    });

    dropArea.addEventListener('dragleave', () => {
        dropArea.style.backgroundColor = '';
    });

    dropArea.addEventListener('drop', (event) => {
        event.preventDefault();
        dropArea.style.backgroundColor = '';

        const files = event.dataTransfer.files;
        if (files.length === 2) {
            const objFile = Array.from(files).find(file => file.name.endsWith('.obj'));
            const mtlFile = Array.from(files).find(file => file.name.endsWith('.mtl'));

            if (objFile && mtlFile) {
                loadModelFromFiles(objFile, mtlFile);
            } else {
                alert('Please drop both .obj and .mtl files.');
            }
        } else {
            alert('Please drop exactly two files (.obj and .mtl).');
        }
    });

    window.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            selectedObject = intersects[0].object;
            console.log("Selected object:", selectedObject.name);
            updateGUIForSelectedObject(selectedObject);
        }
    });

    createMaterialModeBar();
    createAnimationControls();
    animate();
    updateTimeline();
}

function createMaterialModeBar() {
    const materialBar = document.createElement('div');
    materialBar.id = 'materialBar';
    materialBar.style.position = 'fixed';
    materialBar.style.top = '10px';
    materialBar.style.left = '10px';
    materialBar.style.display = 'flex';
    materialBar.style.gap = '10px';
    materialBar.style.zIndex = '9999';
    document.body.appendChild(materialBar);

    const modes = ['wireframe', 'shaded'];
    const icons = ['wireframe.png', 'solid.png'];

    modes.forEach((mode, index) => {
        const button = document.createElement('button');
        const img = document.createElement('img');
        img.src = icons[index];
        img.alt = mode;
        img.style.width = '24px';
        img.style.height = '24px';
        button.title = mode.charAt(0).toUpperCase() + mode.slice(1);
        button.appendChild(img);

        button.addEventListener('click', () => {
            materialMode = mode;
            updateMaterialMode();
        });
        materialBar.appendChild(button);
    });
}

function createAnimationControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'animationControls';
    controlsDiv.style.position = 'fixed';
    controlsDiv.style.bottom = '10px';
    controlsDiv.style.left = '10px';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.gap = '10px';
    controlsDiv.style.zIndex = '9999';
    document.body.appendChild(controlsDiv);

    const playButton = document.createElement('button');
    playButton.innerText = 'Play Animation';
    playButton.onclick = () => { isAnimating = true; };

    const stopButton = document.createElement('button');
    stopButton.innerText = 'Stop Animation';
    stopButton.onclick = () => { isAnimating = false; };

    const nextFrameButton = document.createElement('button');
    nextFrameButton.innerText = 'Next Frame';
    nextFrameButton.onclick = () => {
        if (currentFrame < totalFrames) {
            currentFrame++;

            updateTimeline();
        }
    };

    controlsDiv.appendChild(playButton);
    controlsDiv.appendChild(stopButton);
    controlsDiv.appendChild(nextFrameButton);
}


function updateMaterialMode() {
    scene.traverse(function (child) {
        if (child.isMesh) {
            if (!materialsMap.has(child.name)) {
                materialsMap.set(child.name, child.material.clone());
            }

            switch (materialMode) {
                case 'wireframe':
                    child.material = child.material.clone();
                    child.material.wireframe = true;
                    child.material.color.set(0xffffff);
                    break;

                case 'shaded':
                    child.material = materialsMap.get(child.name).clone();
                    break;
            }

            child.material.needsUpdate = true;
        }
    });
}

function loadModelWithMaterial() {
    const mtlLoader = new THREE.MTLLoader();
    mtlLoader.load('sheep.mtl', function (materials) {
        materials.preload();

        const objLoader = new THREE.OBJLoader();
        objLoader.load('sheep.obj', function (obj) {
            objModel = obj;

            obj.traverse(function (child) {
                if (child.isMesh) {
                    child.material = materials.materials[child.material.name] || child.material;
                    child.material.transparent = true;
                    child.material.opacity = 1;

                    child.material.map.minFilter = THREE.NearestFilter;
                    child.material.map.magFilter = THREE.NearestFilter;

                    animationData[child.name] = { position: [], rotation: [], scale: [] };
                }
            });

            scene.add(objModel);
        });
    });
}

function updateGUIForSelectedObject(object) {
    const gui = new dat.GUI({ autoPlace: false });
    document.getElementById('gui').innerHTML = '';
    document.getElementById('gui').appendChild(gui.domElement);

    const objectFolder = gui.addFolder('Transformations');
    const exportFolder = gui.addFolder('Export');

    const position = { x: object.position.x, y: object.position.y, z: object.position.z };
    objectFolder.add(position, 'x', -10, 10).onChange((val) => object.position.x = val);
    objectFolder.add(position, 'y', -10, 10).onChange((val) => object.position.y = val);
    objectFolder.add(position, 'z', -10, 10).onChange((val) => object.position.z = val);

    const rotation = { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z };
    objectFolder.add(rotation, 'x', -Math.PI, Math.PI).onChange((val) => object.rotation.x = val);
    objectFolder.add(rotation, 'y', -Math.PI, Math.PI).onChange((val) => object.rotation.y = val);
    objectFolder.add(rotation, 'z', -Math.PI, Math.PI).onChange((val) => object.rotation.z = val);

    const scale = { x: object.scale.x, y: object.scale.y, z: object.scale.z };
    objectFolder.add(scale, 'x', 0.1, 5).onChange((val) => object.scale.x = val);
    objectFolder.add(scale, 'y', 0.1, 5).onChange((val) => object.scale.y = val);
    objectFolder.add(scale, 'z', 0.1, 5).onChange((val) => object.scale.z = val);

    objectFolder.add({ save: () => saveKeyframe(object) }, 'save');

    objectFolder.open();
    exportFolder.open();
}

function saveKeyframe(object) {
    if (!object) return;

    const keyframe = {
        frame: currentFrame,
        position: { x: object.position.x, y: object.position.y, z: object.position.z },
        rotation: { x: object.rotation.x, y: object.rotation.y, z: object.rotation.z },
        scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
    };

    console.log("Saving keyframe for", object.name, keyframe);

    animationData[object.name].position.push({ frame: keyframe.frame, ...keyframe.position });
    animationData[object.name].rotation.push({ frame: keyframe.frame, ...keyframe.rotation });
    animationData[object.name].scale.push({ frame: keyframe.frame, ...keyframe.scale });
}

function updateTimeline() {
    timelineContext.clearRect(0, 0, timelineCanvas.width, timelineCanvas.height);
    timelineContext.fillStyle = '#22A7F0';
    timelineContext.fillRect(0, 0, timelineCanvas.width, timelineCanvas.height);

    const keyframes = animationData[selectedObject?.name]?.position || [];

    keyframes.forEach((kf) => {
        const x = (kf.frame / totalFrames) * timelineCanvas.width;
        timelineContext.fillStyle = 'blue';
        timelineContext.fillRect(x - 2, timelineCanvas.height / 2 - 10, 4, 20);
    });

    const currentX = (currentFrame / totalFrames) * timelineCanvas.width;
    timelineContext.fillStyle = '#1B1212';
    timelineContext.fillRect(currentX - 2, timelineCanvas.height / 2 - 10, 4, 20);
}

const moveSpeed = 0.1;

let targetPosition = new THREE.Vector3();
let targetRotation = new THREE.Vector3();
let targetScale = new THREE.Vector3();

function updateObjectTransformations(currentFrame) {
    if (!selectedObject) return;

    const positionKeyframes = animationData[selectedObject.name]?.position || [];
    const rotationKeyframes = animationData[selectedObject.name]?.rotation || [];
    const scaleKeyframes = animationData[selectedObject.name]?.scale || [];

    const { prevKeyframe: prevPos, nextKeyframe: nextPos } = findSurroundingKeyframes(positionKeyframes, currentFrame);
    const { prevKeyframe: prevRot, nextKeyframe: nextRot } = findSurroundingKeyframes(rotationKeyframes, currentFrame);
    const { prevKeyframe: prevScale, nextKeyframe: nextScale } = findSurroundingKeyframes(scaleKeyframes, currentFrame);

    if (prevPos && nextPos) {
        selectedObject.position.x = interpolateValue(prevPos.x, nextPos.x, prevPos.frame, nextPos.frame, currentFrame);
        selectedObject.position.y = interpolateValue(prevPos.y, nextPos.y, prevPos.frame, nextPos.frame, currentFrame);
        selectedObject.position.z = interpolateValue(prevPos.z, nextPos.z, prevPos.frame, nextPos.frame, currentFrame);
    }

    if (prevRot && nextRot) {
        selectedObject.rotation.x = interpolateValue(prevRot.x, nextRot.x, prevRot.frame, nextRot.frame, currentFrame);
        selectedObject.rotation.y = interpolateValue(prevRot.y, nextRot.y, prevRot.frame, nextRot.frame, currentFrame);
        selectedObject.rotation.z = interpolateValue(prevRot.z, nextRot.z, prevRot.frame, nextRot.frame, currentFrame);
    }

    if (prevScale && nextScale) {
        selectedObject.scale.x = interpolateValue(prevScale.x, nextScale.x, prevScale.frame, nextScale.frame, currentFrame);
        selectedObject.scale.y = interpolateValue(prevScale.y, nextScale.y, prevScale.frame, nextScale.frame, currentFrame);
        selectedObject.scale.z = interpolateValue(prevScale.z, nextScale.z, prevScale.frame, nextScale.frame, currentFrame);
    }
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    if (isAnimating) {

        if (currentFrame < totalFrames) {
            updateObjectTransformations(currentFrame);
            currentFrame++;
        } else {
            currentFrame = 0;
        }
        updateTimeline();
    }

    renderer.render(scene, camera);
}
function findSurroundingKeyframes(keyframes, currentFrame) {
    let prevKeyframe = null;
    let nextKeyframe = null;

    for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i].frame <= currentFrame) {
            prevKeyframe = keyframes[i];
        }
        if (keyframes[i].frame > currentFrame) {
            nextKeyframe = keyframes[i];
            break;
        }
    }

    return { prevKeyframe, nextKeyframe };
}

function interpolateValue(prevValue, nextValue, prevFrame, nextFrame, currentFrame) {
    const alpha = (currentFrame - prevFrame) / (nextFrame - prevFrame);
    return lerp(prevValue, nextValue, alpha);
}

function lerp(start, end, alpha) {
    return start + (end - start) * alpha;
}

function getPositionData(frame) {
    if (!selectedObject) return null;

    const keyframes = animationData[selectedObject.name]?.position || [];
    const keyframe = keyframes.find(kf => kf.frame === frame);

    return keyframe ? { x: keyframe.x, y: keyframe.y, z: keyframe.z } : null;
}

function getRotationData(frame) {
    if (!selectedObject) return null;

    const keyframes = animationData[selectedObject.name]?.rotation || [];
    const keyframe = keyframes.find(kf => kf.frame === frame);

    return keyframe ? { x: keyframe.x, y: keyframe.y, z: keyframe.z } : null;
}

function getScaleData(frame) {
    if (!selectedObject) return null;

    const keyframes = animationData[selectedObject.name]?.scale || [];
    const keyframe = keyframes.find(kf => kf.frame === frame);

    return keyframe ? { x: keyframe.x, y: keyframe.y, z: keyframe.z } : null;
}

init();
