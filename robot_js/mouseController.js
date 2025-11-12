import * as THREE from 'three';

export default class MouseController {
  constructor({
    camera,
    domElement,
    onTargetMove,     // (vec3) => void
    onToggleGrip,     // () => void (optional extra callback)
    plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    gripperInput = null // optional: HTMLInputElement or null (defaults to #gripper)
  }) {
    this.camera = camera;
    this.domElement = domElement;
    this.onTargetMove = onTargetMove || (() => {});
    this.onToggleGrip = onToggleGrip || (() => {});
    this.plane = plane;

    // If not provided, try to find the slider used by the existing UI
    this.gripperInput =
      gripperInput ||
      (typeof document !== 'undefined' ? document.getElementById('gripper') : null);

    this.raycaster = new THREE.Raycaster();
    this.mouseNDC = new THREE.Vector2();

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);

    domElement.addEventListener('mousemove', this._onMouseMove, { passive: true });
    domElement.addEventListener('mousedown', this._onMouseDown, false);

    // Hide native cursor so the “blue sphere” can be fully invisible
    domElement.style.cursor = 'none';
  }

  dispose() {
    this.domElement.removeEventListener('mousemove', this._onMouseMove);
    this.domElement.removeEventListener('mousedown', this._onMouseDown);
  }

  // Public: toggle the gripper by flipping the UI slider value and dispatching 'input'
  toggleGripper() {
    if (this.gripperInput) {
      const cur = String(this.gripperInput.value) === '1' ? '1' : '0';
      this.gripperInput.value = cur === '1' ? '0' : '1';
      // Fire the same event your UI/JointController listens for
      this.gripperInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Optional external hook
    this.onToggleGrip();
  }

  _screenToWorldOnPlane(clientX, clientY) {
    const rect = this.domElement.getBoundingClientRect();
    this.mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNDC, this.camera);
    const hit = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(this.plane, hit);
    return hit;
  }

  _onMouseMove(e) {
    const world = this._screenToWorldOnPlane(e.clientX, e.clientY);
    if (world && isFinite(world.x) && isFinite(world.y) && isFinite(world.z)) {
      this.onTargetMove(world);
    }
  }

  _onMouseDown(e) {
    // Left button toggles the gripper
    if (e.button === 0) this.toggleGripper();
  }
}
