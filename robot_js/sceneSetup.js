import * as THREE from 'three';

export function createScene() {
    const scene = new THREE.Scene();
    
    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
    keyLight.position.set(2.2, 3.6, 2.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);
    
    return scene;
}

export function createCamera(aspect) {
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 200);
    camera.position.set(2.2, 1.4, 2.8);
    camera.lookAt(0.4, 0.7, 0);
    return camera;
}

export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ 
        canvas, 
        antialias: true, 
        alpha: true 
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    return renderer;
}

export function createMaterials() {
    return {
        base: new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            metalness: 0.5, 
            roughness: 1.0 
        }),
        link: new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            metalness: 0.5, 
            roughness: 0.7 
        }),
        gripper: new THREE.MeshStandardMaterial({ 
            color: 0xe0e0e0, 
            metalness: 0.5, 
            roughness: 0.5 
        })
    };
}