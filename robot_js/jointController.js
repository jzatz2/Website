import * as THREE from 'three';

export class JointController {
  constructor(nodes, gripperNodes, ikSolver){
    this.nodes = nodes;
    this.gripperNodes = gripperNodes;
    this.ikSolver = ikSolver;

    // — keep your hard-set startup orientation —
    const HARDSET_J1_DEG = 30;
    const HARDSET_J4_DEG = 0;
    const HARDSET_J6_DEG = -96;

    this.nodes.link1.joint.rotation.z = THREE.MathUtils.degToRad(HARDSET_J1_DEG);
    this.nodes.link4.joint.rotation.z = THREE.MathUtils.degToRad(HARDSET_J4_DEG);
    this.nodes.link6.joint.rotation.z = THREE.MathUtils.degToRad(HARDSET_J6_DEG);

    this.jointAngles = {
      joint1: this.nodes.link1.joint.rotation.z,
      joint2: this.nodes.link2.joint.rotation.z,
      joint3: this.nodes.link3.joint.rotation.z,
      joint4: this.nodes.link4.joint.rotation.z,
      joint5: this.nodes.link5.joint.rotation.z,
      joint6: this.nodes.link6.joint.rotation.z
    };

    // lock J1 so it keeps that initial pose (as before)
    this.lockJ1 = true;
    this.lockJ4 = false;
    this.lockJ6 = false;

    // UI-free defaults
    this.gripperOpen = false;
    this.mouseMode = true;      // <- ON by default
    this.ikTargetWorld = null;

    // Safe: will no-op if UI elements don't exist
    this._wireUI();
  }

  setJointLock(jIndex, locked){
    if (jIndex === 1) this.lockJ1 = !!locked;
    else if (jIndex === 4) this.lockJ4 = !!locked;
    else if (jIndex === 6) this.lockJ6 = !!locked;
  }
  toggleJointLock(jIndex){
    if (jIndex === 1) this.lockJ1 = !this.lockJ1;
    else if (jIndex === 4) this.lockJ4 = !this.lockJ4;
    else if (jIndex === 6) this.lockJ6 = !this.lockJ6;
  }

  setMouseMode(on){
    this.mouseMode = !!on;
    // if sliders exist (legacy UI), disable them; otherwise no-op
    ['joint2','joint3','joint5'].forEach(id=>{
      const s=document.getElementById(id);
      if (s) s.disabled = this.mouseMode;
    });
  }

  setIKTarget(worldVec3){
    this.ikTargetWorld = worldVec3 ? worldVec3.clone() : null;
  }

  toggleGripper(){
    this.gripperOpen = !this.gripperOpen;
    // update any legacy label if present
    const vg=document.getElementById('gripper-value');
    if (vg) vg.textContent = this.gripperOpen ? 'Open' : 'Closed';
  }

  _wireUI(){
    const s2=document.getElementById('joint2');
    const s3=document.getElementById('joint3');
    const s5=document.getElementById('joint5');
    const sg=document.getElementById('gripper');

    const v2=document.getElementById('joint2-value');
    const v3=document.getElementById('joint3-value');
    const v5=document.getElementById('joint5-value');
    const vg=document.getElementById('gripper-value');
    const label=(el,deg)=> { if (el) el.textContent = `${Math.round(deg)}°`; };

    if (s2) s2.addEventListener('input', ()=>{
      this.jointAngles.joint2 = THREE.MathUtils.degToRad(parseFloat(s2.value));
      label(v2, s2.value);
    });
    if (s3) s3.addEventListener('input', ()=>{
      this.jointAngles.joint3 = THREE.MathUtils.degToRad(parseFloat(s3.value));
      label(v3, s3.value);
    });
    if (s5) s5.addEventListener('input', ()=>{
      this.jointAngles.joint5 = THREE.MathUtils.degToRad(parseFloat(s5.value));
      label(v5, s5.value);
    });

    if (sg) sg.addEventListener('input', ()=>{
      this.gripperOpen = parseInt(sg.value,10) === 1;
      if (vg) vg.textContent = this.gripperOpen ? 'Open' : 'Closed';
    });

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', ()=>{
      if (s2) { s2.value=0; }
      if (s3) { s3.value=0; }
      if (s5) { s5.value=0; }
      if (sg) { sg.value=0; }
      if (v2) v2.textContent='0°';
      if (v3) v3.textContent='0°';
      if (v5) v5.textContent='0°';
      if (vg) vg.textContent='Closed';
      this.jointAngles.joint2=0;
      this.jointAngles.joint3=0;
      this.jointAngles.joint5=0;
      this.gripperOpen=false;
    });
  }

  update(){
    // IK (planar): q2,q3,q5
    if (this.mouseMode && this.ikTargetWorld){
      const q0 = [this.jointAngles.joint2, this.jointAngles.joint3, this.jointAngles.joint5];
      const targetXY = new THREE.Vector2(this.ikTargetWorld.x, this.ikTargetWorld.y);

      let q = this.ikSolver.solveIK(targetXY, q0, 0.40, 120, 0.02);
      const cur = this.ikSolver.forwardKinematics(q);
      const err2 = (cur.x - targetXY.x)*(cur.x - targetXY.x) + (cur.y - targetXY.y)*(cur.y - targetXY.y);
      if (err2 > 1e-8) q = this.ikSolver.solveIK(targetXY, q, 0.40, 120, 0.02);

      this.jointAngles.joint2 = q[0];
      this.jointAngles.joint3 = q[1];
      this.jointAngles.joint5 = q[2];

      // if legacy labels exist, update them; harmless otherwise
      const v2=document.getElementById('joint2-value');
      const v3=document.getElementById('joint3-value');
      const v5=document.getElementById('joint5-value');
      if (v2) v2.textContent=`${Math.round(THREE.MathUtils.radToDeg(this.jointAngles.joint2))}°`;
      if (v3) v3.textContent=`${Math.round(THREE.MathUtils.radToDeg(this.jointAngles.joint3))}°`;
      if (v5) v5.textContent=`${Math.round(THREE.MathUtils.radToDeg(this.jointAngles.joint5))}°`;
    }

    // keep hard-set pose for locked joints
    if (this.lockJ1) this.nodes.link1.joint.rotation.z = this.jointAngles.joint1;
    if (this.lockJ4) this.nodes.link4.joint.rotation.z = this.jointAngles.joint4;
    if (this.lockJ6) this.nodes.link6.joint.rotation.z = this.jointAngles.joint6;

    // always write IK joints
    this.nodes.link2.joint.rotation.z = this.jointAngles.joint2;
    this.nodes.link3.joint.rotation.z = this.jointAngles.joint3;
    this.nodes.link5.joint.rotation.z = this.jointAngles.joint5;

    this.updateGripper();
  }

  updateGripper(){
    const a = this.gripperOpen ? 0.61 : 0.0;
    this.gripperNodes.left_outer_knuckle.joint.rotation.x  =  a;
    this.gripperNodes.left_finger.joint.rotation.x         = -a;
    this.gripperNodes.left_inner_knuckle.joint.rotation.x  =  a;
    this.gripperNodes.right_outer_knuckle.joint.rotation.x = -a;
    this.gripperNodes.right_finger.joint.rotation.x        =  a;
    this.gripperNodes.right_inner_knuckle.joint.rotation.x = -a;
  }
}
