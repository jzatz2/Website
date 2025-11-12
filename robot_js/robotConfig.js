export const ROBOT_CONFIG = {
    base:  { parent: "ground", pos: [0, 0, 0],           quat: [1, 0, 0, 0] },
    link1: { parent: "base",   pos: [0, 0, 0.267],       quat: [1, 0, 0, 0],                     axis: [0, 0, 1] },
    link2: { parent: "link1",  pos: [0, 0, 0],           quat: [0.70710678, -0.70710678, 0, 0],  axis: [0, 0, 1] },
    link3: { parent: "link2",  pos: [0.0535, -0.2845, 0], quat: [1, 0, 0, 0],                    axis: [0, 0, 1] },
    link4: { parent: "link3",  pos: [0.0775, 0.3425, 0],  quat: [0.70710678, -0.70710678, 0, 0], axis: [0, 0, 1] },
    link5: { parent: "link4",  pos: [0, 0, 0],           quat: [0.70710678, 0.70710678, 0, 0],   axis: [0, 0, 1] },
    link6: { parent: "link5",  pos: [0.076, 0.097, 0],   quat: [0.70710678, -0.70710678, 0, 0],  axis: [0, 0, 1] }
};

export const GRIPPER_CONFIG = {
    base: { parent: "link6", pos: [0, 0, 0], quat: [1, 0, 0, 0] },
    left_outer_knuckle:  { parent: "base", pos: [0,  0.035,   0.059098], quat: [1, 0, 0, 0], axis: [ 1, 0, 0] },
    left_finger:         { parent: "left_outer_knuckle", pos: [0,  0.035465, 0.042039], quat: [1, 0, 0, 0], axis: [-1, 0, 0] },
    left_inner_knuckle:  { parent: "base", pos: [0,  0.02,    0.074098],  quat: [1, 0, 0, 0], axis: [ 1, 0, 0] },
    right_outer_knuckle: { parent: "base", pos: [0, -0.035,   0.059098],  quat: [1, 0, 0, 0], axis: [-1, 0, 0] },
    right_finger:        { parent: "right_outer_knuckle", pos: [0, -0.035465, 0.042039], quat: [1, 0, 0, 0], axis: [ 1, 0, 0] },
    right_inner_knuckle: { parent: "base", pos: [0, -0.02,    0.074098],  quat: [1, 0, 0, 0], axis: [-1, 0, 0] }
};

export const LINK_ORDER = ["base", "link1", "link2", "link3", "link4", "link5", "link6"];
export const GRIPPER_ORDER = ["base", "left_outer_knuckle", "left_finger", "left_inner_knuckle", 
                               "right_outer_knuckle", "right_finger", "right_inner_knuckle"];

// Mesh file paths
export const MESH_PATHS = {
    base:  'xarm_description/meshes/xarm6_1305/visual/link_base.stl',
    link1: 'xarm_description/meshes/xarm6_1305/visual/link1.stl',
    link2: 'xarm_description/meshes/xarm6_1305/visual/link2.stl',
    link3: 'xarm_description/meshes/xarm6_1305/visual/link3.stl',
    link4: 'xarm_description/meshes/xarm6_1305/visual/link4.stl',
    link5: 'xarm_description/meshes/xarm6_1305/visual/link5.stl',
    link6: 'xarm_description/meshes/xarm6_1305/visual/link6.stl',
};

export const GRIPPER_MESH_PATHS = {
    base:                 'xarm_description/meshes/gripper/xarm/base_link.stl',
    left_outer_knuckle:   'xarm_description/meshes/gripper/xarm/left_outer_knuckle.stl',
    left_finger:          'xarm_description/meshes/gripper/xarm/left_finger.stl',
    left_inner_knuckle:   'xarm_description/meshes/gripper/xarm/left_inner_knuckle.stl',
    right_outer_knuckle:  'xarm_description/meshes/gripper/xarm/right_outer_knuckle.stl',
    right_finger:         'xarm_description/meshes/gripper/xarm/right_finger.stl',
    right_inner_knuckle:  'xarm_description/meshes/gripper/xarm/right_inner_knuckle.stl',
};

// Joint limits in rad
export const JOINT_LIMITS = {
    min: [-2.059, -3.927, -6.2832, -1.69297, -6.2832],  // link2-6
    max: [ 2.0944, 0.19198, -6.2832, 3.14159, -6.2832]
};

// IK parameters
export const IK_CONFIG = {
    stepSize: 0.3,          // Reduced = stability
    damping: 0.01,          // Damping = numerical stability
    iterations: 5,          
    
    // Collision avoidance
    selfCollisionDistance: 0.22,
    repulsionStrength: 0.35,
    
    // Workspace limits
    reachMin: 0.20,
    reachMax: 1.15
};