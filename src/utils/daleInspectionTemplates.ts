import { DaleProcessType, DaleInspectionPoint, DaleInspectionRecord } from '../types';

export interface DaleProcessDefinition {
  type: DaleProcessType;
  title: string;
  category: string;
  scopeDescription: string;
  shortDesc: string;
  points: Array<{
    pointNumber: number;
    description: string;
    requirement: string;
    mandatory: boolean;
    requiresMeasurement: boolean;
    measurementUnit?: string;
    measurementPlaceholder?: string;
  }>;
}

export const DALE_PROCESS_DEFINITIONS: Record<DaleProcessType, DaleProcessDefinition> = {
  // 1. FABRICATION & WELDING
  FABRICATION_WELDING: {
    type: 'FABRICATION_WELDING',
    title: '1. Fabrication & Welding',
    category: 'Structural & Sheetmetal',
    scopeDescription:
      'For stainless-steel frames, conveyor bodies, spiral structures, supports, guards and fabricated components.',
    shortDesc: 'Material, drawing/rev, dimensions, weld quality, distortion, deburring, finish & identification',
    points: [
      {
        pointNumber: 1,
        description: 'Correct material',
        requirement: 'Material grade, certificate & thickness verified against drawing (AISI 304 / 316L / mild steel)',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Grade / Thk',
        measurementPlaceholder: 'e.g. 1.5mm AISI 304 Satin',
      },
      {
        pointNumber: 2,
        description: 'Drawing and revision',
        requirement: 'Approved engineering drawing & revision verified against production traveler',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Overall dimensions',
        requirement: 'Overall length, width and height within general fabrication tolerances',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 1250 x 650 x 850 mm',
      },
      {
        pointNumber: 4,
        description: 'Critical dimensions',
        requirement: 'Critical mounting centers, datum offsets and flange squareness verified to drawing',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 507.1 x 557.3 mm ±0.5',
      },
      {
        pointNumber: 5,
        description: 'Weld quality and completeness',
        requirement: 'Uniform bead profile, full penetration, no cracks, porosity, undercut or blow-through',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Distortion',
        requirement: 'Frame squareness, diagonal tolerance and weld heat distortion within acceptable limits',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.4 mm max deviation',
      },
      {
        pointNumber: 7,
        description: 'Sharp edges/burrs',
        requirement: 'All laser dross, sharp corners and burrs ground flush, safe for operator handling',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'Surface/finish',
        requirement: 'Weld spatter removed, weld pickling/passivation complete, grain linished per sanitary spec',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Holes, slots and mounting points',
        requirement: 'Hole pitch, slot clearance and tapped threads clean and verified with thread gage',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm / Pitch',
        measurementPlaceholder: 'e.g. 4x M8 tapped / 12mm holes',
      },
      {
        pointNumber: 10,
        description: 'Part identification',
        requirement: 'Part number, drawing revision and project job number stamped or tagged per traceability standard',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },

  // 2. MACHINED COMPONENTS
  MACHINED_COMPONENTS: {
    type: 'MACHINED_COMPONENTS',
    title: '2. Machined Components',
    category: 'Precision CNC Turning & Milling',
    scopeDescription:
      'For shafts, sprockets, collars, rollers, drive components and other CNC/lathe-machined parts.',
    shortDesc: 'Material, drawing/rev, critical dimensions, tolerances, holes/threads, fit dimensions, surface finish, burrs & ID',
    points: [
      {
        pointNumber: 1,
        description: 'Material',
        requirement: 'Raw stock specification and grade verified (EN24T, 316L, 304, acetal/engineering plastic)',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Grade',
        measurementPlaceholder: 'e.g. EN24T High-Tensile Steel',
      },
      {
        pointNumber: 2,
        description: 'Drawing/revision',
        requirement: 'Part manufactured to current approved drawing revision loaded in QMS',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Critical dimensions',
        requirement: 'Bearing journals, shoulder lengths, overall length and step diameters measured',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 50.010 mm journal OD',
      },
      {
        pointNumber: 4,
        description: 'Tolerances',
        requirement: 'Precision ISO fit tolerances (e.g. g6, h6, H7, js6) verified with micrometer/caliper',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. Ø50.000 +0.02/-0.02 mm',
      },
      {
        pointNumber: 5,
        description: 'Hole/thread size',
        requirement: 'Tapped threads gauged with GO/NO-GO plug, thread depth and hole diameters verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Thread / mm',
        measurementPlaceholder: 'e.g. M12 6H GO / Ø14.0mm bore',
      },
      {
        pointNumber: 6,
        description: 'Shaft/fit dimensions',
        requirement: 'Keyway width, depth, runout, concentricity and interference fit diameters measured',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 14.00mm keyway / 0.02 TIR',
      },
      {
        pointNumber: 7,
        description: 'Surface condition',
        requirement: 'Surface finish roughness (Ra) meets drawing spec; free from chatter, tool marks and gouges',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Ra µm',
        measurementPlaceholder: 'e.g. Ra 0.4 µm ground finish',
      },
      {
        pointNumber: 8,
        description: 'Burrs/damage',
        requirement: 'Edges chamfered, threads deburred, component clean and free from handling damage or corrosion',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Part identification',
        requirement: 'Part number, drawing revision & serial number marked permanently on designated datum',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },
  // Alias for backward compatibility
  MACHINED_PARTS: {
    type: 'MACHINED_PARTS',
    title: '2. Machined Components',
    category: 'Precision CNC Turning & Milling',
    scopeDescription:
      'For shafts, sprockets, collars, rollers, drive components and other CNC/lathe-machined parts.',
    shortDesc: 'Material, drawing/rev, critical dimensions, tolerances, holes/threads, fit dimensions, surface finish, burrs & ID',
    points: [], // Dynamically mapped below
  },

  // 3. CONVEYOR COMPONENTS
  CONVEYOR_COMPONENTS: {
    type: 'CONVEYOR_COMPONENTS',
    title: '3. Conveyor Components',
    category: 'Conveyor Drive & Motion Systems',
    scopeDescription:
      'For conveyor frames, belts, sprockets, shafts, bearings, guides, wear strips, supports and transfer mechanisms.',
    shortDesc: 'Correct components, dimensions, frame alignment, shaft/sprocket alignment, bearings, belt tracking, fasteners, guards, smooth movement',
    points: [
      {
        pointNumber: 1,
        description: 'Correct components',
        requirement: 'All modular parts, belt type, sprockets, wear strips, guides and drive brackets conform to BOM',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Dimensions',
        requirement: 'Conveyor bed width, overall length, infeed/discharge transfer heights verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 620.0 mm bed width',
      },
      {
        pointNumber: 3,
        description: 'Frame alignment',
        requirement: 'Side frames parallel, slider bed level and square without diagonal twisting or bowing',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.5 mm diagonal squareness',
      },
      {
        pointNumber: 4,
        description: 'Shaft/sprocket alignment',
        requirement: 'Drive & idler shafts square to frame center-line; sprockets aligned across shaft spacing',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.1 mm runout / square',
      },
      {
        pointNumber: 5,
        description: 'Bearing installation',
        requirement: 'Flange/pillow bearings seated correctly, locking collars torqued, grease seals intact',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Belt fit/tracking',
        requirement: 'Belt fitted, tension adjusted, wear strip clearance verified, belt tracks centrally without drifting',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 2.0 mm guide clearance',
      },
      {
        pointNumber: 7,
        description: 'Fasteners',
        requirement: 'All mechanical fasteners torqued, spring washers/locking nuts present, no loose fixings',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'Guards',
        requirement: 'Nip point safety guards, valance side covers and drive chain covers fitted and secure',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Free/smooth movement',
        requirement: 'Conveyor belt & rollers turn freely by hand without binding, abnormal friction or rubbing',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },

  // 4. SPIRAL SYSTEM COMPONENTS
  SPIRAL_SYSTEMS: {
    type: 'SPIRAL_SYSTEMS',
    title: '4. Spiral System Components',
    category: 'Spiral Systems & Drum Conveyors',
    scopeDescription:
      'For spiral drums, supports, belt systems and drive assemblies.',
    shortDesc: 'Drawing/rev, drum dimensions, level & alignment, section fit-up, belt path, drive alignment, supports/fasteners, welds, rotation test, ID',
    points: [
      {
        pointNumber: 1,
        description: 'Drawing/revision',
        requirement: 'Spiral structure verified against latest approved engineering GA drawings',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Drum/structure dimensions',
        requirement: 'Outer drum cage diameter, tier pitch, overall height and tier clearances verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. Ø450.0 mm cage / 160mm pitch',
      },
      {
        pointNumber: 3,
        description: 'Level and alignment',
        requirement: 'Main vertical support columns plumb; base foundation ring level across all quadrants',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm/m',
        measurementPlaceholder: 'e.g. 0.2 mm/m plumb',
      },
      {
        pointNumber: 4,
        description: 'Section fit-up',
        requirement: 'Tier guide rail joints, splice plates and transitions smooth, flush with zero steps',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 5,
        description: 'Belt path',
        requirement: 'Infeed transition curve, drum radius guides, return wear strips and take-up path aligned',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Drive alignment',
        requirement: 'Central drum drive motor/gearbox, main drive chain, sprockets and torque limiter aligned',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.05 mm chain alignment',
      },
      {
        pointNumber: 7,
        description: 'Supports and fasteners',
        requirement: 'Cross-bracing rigid, structural high-tensile bolts torqued to specification, locking fasteners confirmed',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'Weld quality',
        requirement: 'All stainless structural welds sound, sanitary food-contact welds passivated and crevice-free',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Rotation/free movement',
        requirement: 'Drum rotates smoothly by hand; radial cage clearance uniform with zero rubbing on belt guides',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 5.0 mm uniform clearance',
      },
      {
        pointNumber: 10,
        description: 'Identification',
        requirement: 'Tier numbering, rotation direction arrows, drum serial plate & job details affixed',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },

  // 5. MECHANICAL ASSEMBLY
  MECHANICAL_ASSEMBLY: {
    type: 'MECHANICAL_ASSEMBLY',
    title: '5. Mechanical Assembly',
    category: 'Mechanical Build & Handling Systems',
    scopeDescription:
      'For completed mechanical assemblies, pan/lid handling equipment, product handling equipment, robotic mechanisms and machine subassemblies.',
    shortDesc: 'Correct parts, drawing/rev, assembly orientation, alignment, fasteners/torque, lubrication, free movement, no interference, guards, ID',
    points: [
      {
        pointNumber: 1,
        description: 'Correct parts/components',
        requirement: 'All mechanical parts, bearings, linkages, pneumatics, and fasteners match approved BOM pick list',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Correct drawing/revision',
        requirement: 'Assembly conforms to current approved GA assembly drawing revision in QMS',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Assembly orientation',
        requirement: 'Sub-assembly handing (LH/RH), mounting orientation and product flow direction verified',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 4,
        description: 'Alignment',
        requirement: 'Sub-assemblies square, true, proper clearances, datum centers and parallelism confirmed',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.2 mm deviation',
      },
      {
        pointNumber: 5,
        description: 'Fasteners/torque where specified',
        requirement: 'All mechanical fasteners torqued to specified Nm; thread-locking compound applied where indicated',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Nm',
        measurementPlaceholder: 'e.g. 25 Nm (M8) / 49 Nm (M10)',
      },
      {
        pointNumber: 6,
        description: 'Lubrication where specified',
        requirement: 'Approved food-grade grease/oil applied to linear guides, slides, bushings and bearings',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 7,
        description: 'Moving parts operate freely',
        requirement: 'Smooth mechanical actuation throughout complete stroke; stops, dampeners and limits operational',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'No interference/contact',
        requirement: 'Adequate operational clearances confirmed; zero mechanical clashes between moving and static parts',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 6.0 mm minimum clearance',
      },
      {
        pointNumber: 9,
        description: 'Guards/components fitted',
        requirement: 'All protective covers, finger guards, inspection panels, limit switch brackets securely fitted',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 10,
        description: 'Identification',
        requirement: 'Sub-assembly identification tag, serial number plate and safety warning labels affixed',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },
  // Alias for backward compatibility
  ASSEMBLY: {
    type: 'ASSEMBLY',
    title: '5. Mechanical Assembly',
    category: 'Mechanical Build & Handling Systems',
    scopeDescription:
      'For completed mechanical assemblies, pan/lid handling equipment, product handling equipment, robotic mechanisms and machine subassemblies.',
    shortDesc: 'Correct parts, drawing/rev, assembly orientation, alignment, fasteners/torque, lubrication, free movement, no interference, guards, ID',
    points: [], // Dynamically mapped below
  },

  // 6. ELECTRICAL CONTROL PANEL
  ELECTRICAL_CONTROL_PANEL: {
    type: 'ELECTRICAL_CONTROL_PANEL',
    title: '6. Electrical Control Panel',
    category: 'Automation & Panel Building',
    scopeDescription:
      'For Dale-manufactured control panels and electrical assemblies.',
    shortDesc: 'Panel/drawing rev, components, labels, wiring/termination, cable routing, terminal tightness, earthing, enclosure condition, continuity/insulation, functional test, safety check',
    points: [
      {
        pointNumber: 1,
        description: 'Correct panel and drawing revision',
        requirement: 'Control panel build conforms to approved electrical schematic drawing revision',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Correct components',
        requirement: 'Main isolator, circuit breakers, contactors, VFDs, PLC, safety relays & power supply match BOM',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Component labels',
        requirement: 'All DIN-rail devices, terminals, pushbuttons, pilot lights and door controls legibly labeled',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 4,
        description: 'Wiring/termination',
        requirement: 'All wire ends bootlace ferruled, wire numbers match schematic, no stray copper strands',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 5,
        description: 'Cable routing',
        requirement: 'Slotted trunking tidy, power and 24VDC signal wiring segregated, door wiring loom protected with spiral wrap',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Terminal tightness',
        requirement: '100% of terminal screw connections torqued, push-in terminals pull-tested for secure grip',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 7,
        description: 'Earthing',
        requirement: 'PE protective earth bonding loop continuous to door, enclosure chassis, backplate and gland plates',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Ω',
        measurementPlaceholder: 'e.g. 0.04 Ω earth bond',
      },
      {
        pointNumber: 8,
        description: 'Enclosure condition',
        requirement: 'IP sealing gasket intact, gland plates fitted, no paint scratches, enclosure doors latch properly',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Basic continuity/insulation checks where required',
        requirement: 'Earth bonding continuity verified (< 0.1Ω); 500VDC insulation resistance verified (> 50 MΩ)',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'MΩ',
        measurementPlaceholder: 'e.g. > 100 MΩ insulation',
      },
      {
        pointNumber: 10,
        description: 'Basic functional test',
        requirement: 'Control circuit powered, 24VDC bus verified, safety relay resets, E-stop loop cuts power',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 11,
        description: 'Panel identification',
        requirement: 'Panel rating plate, electrical warning flash, CE/UKCA mark and schematic drawing pouch complete',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 12,
        description: 'Basic safety check (covers, earth bonding, IP sealing where applicable)',
        requirement: 'All finger guards/covers in place, earth bond verified, gland plates sealed, hazard warning stickers affixed',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },
  // Alias for backward compatibility
  ELECTRICAL_PANELS: {
    type: 'ELECTRICAL_PANELS',
    title: '6. Electrical Control Panel',
    category: 'Automation & Panel Building',
    scopeDescription:
      'For Dale-manufactured control panels and electrical assemblies.',
    shortDesc: 'Panel/drawing rev, components, labels, wiring/termination, cable routing, terminal tightness, earthing, enclosure condition, continuity/insulation, functional test, panel ID',
    points: [], // Dynamically mapped below
  },

  // 7. ROBOTIC / AUTOMATION ASSEMBLY
  ROBOTIC_AUTOMATION_ASSEMBLY: {
    type: 'ROBOTIC_AUTOMATION_ASSEMBLY',
    title: '7. Robotic / Automation Assembly',
    category: 'Robotics & Automated Tooling',
    scopeDescription:
      'For robot end-effectors, magnetic/vacuum heads, sensors, pneumatic mechanisms and automated handling assemblies.',
    shortDesc: 'Components, drawing/rev, mechanical fit, alignment, grippers/magnets/vacuum, sensors/actuators, fasteners, cable/air, movement test, ID',
    points: [
      {
        pointNumber: 1,
        description: 'Correct components',
        requirement: 'Robot adapter plate, pneumatic cylinders, vacuum generator, grippers, and sensors match BOM',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Drawing/revision',
        requirement: 'End-effector or automation assembly conforms to approved engineering tooling drawing revision',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Mechanical fit',
        requirement: 'Robot wrist ISO flange mount, locating dowel pins and adapter plate fit securely without play',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. Ø50 H7 dowel locating',
      },
      {
        pointNumber: 4,
        description: 'Alignment',
        requirement: 'Gripper fingers parallel, vacuum cup grid square, magnetic head datum centers verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 0.1 mm parallelism',
      },
      {
        pointNumber: 5,
        description: 'Grippers/magnets/vacuum components',
        requirement: 'Suction cups undamaged, magnetic poles clean, gripper jaws smooth with specified grip pads',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Sensors/actuators installed',
        requirement: 'Proximity sensors, cylinder magnetic reed switches and optical part-present sensors positioned & locked',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 7,
        description: 'Fasteners',
        requirement: 'All tooling mounting bolts torqued to specification, vibration-resistant locking washers fitted',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'Nm',
        measurementPlaceholder: 'e.g. 35 Nm tooling mount',
      },
      {
        pointNumber: 8,
        description: 'Cable/air connections',
        requirement: 'Pneumatic tubing routed in drag chain without kinks; M8/M12 sensor cables clamped and labeled',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Basic movement/function test',
        requirement: 'Manual pneumatic stroke cycle smooth; vacuum seal creates holding pressure; jaws actuate cleanly',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'bar / kPa',
        measurementPlaceholder: 'e.g. -75 kPa vacuum seal',
      },
      {
        pointNumber: 10,
        description: 'Identification',
        requirement: 'Tooling nameplate, serial number, pneumatic port tags (P, A, B) and warning notices labeled',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },

  // 8. REFRIGERATION / COOLING COMPONENT ASSEMBLY
  REFRIGERATION_COOLING_ASSEMBLY: {
    type: 'REFRIGERATION_COOLING_ASSEMBLY',
    title: '8. Refrigeration / Cooling Component Assembly',
    category: 'Spiral Cooling & CIP Assemblies',
    scopeDescription:
      'For spiral cooling/freezing assemblies, evaporator-related assemblies, fans, belt-washing/CIP assemblies and associated manufactured components.',
    shortDesc: 'Components, drawing/rev, dimensions, connections/fittings, mounting, alignment, weld quality, fan movement, ID, basic leak check',
    points: [
      {
        pointNumber: 1,
        description: 'Correct components',
        requirement: 'Evaporator coil mounts, circulation fans, drip trays, CIP spray headers & nozzles conform to BOM',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Drawing/revision',
        requirement: 'Manufactured cooling/CIP assemblies built to current approved engineering drawings',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Dimensions',
        requirement: 'Drip tray slope, coil mounting envelope and fan orifice clearances verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 15mm drain fall / 850mm span',
      },
      {
        pointNumber: 4,
        description: 'Connections/fittings',
        requirement: 'Sanitary tri-clamp fittings, drain outlets, spray nozzle couplings tight and undamaged',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 5,
        description: 'Mounting',
        requirement: 'Heavy coil and fan support brackets rigid, anti-vibration mountings fitted where specified',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 6,
        description: 'Alignment',
        requirement: 'Fan blades centered in shroud orifice; ducting transitions flush with zero gap',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 4.0 mm uniform blade gap',
      },
      {
        pointNumber: 7,
        description: 'Weld/finish quality',
        requirement: 'Stainless 304/316 welds passivated; internal drip tray surfaces crevice-free for clean drainage',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'Fan/free movement',
        requirement: 'Fan impellers rotate freely by hand with uniform tip clearance, no rubbing against cowling',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Identification',
        requirement: 'Fan rotation direction arrows, CIP zone markings, component serial tags permanently affixed',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 10,
        description: 'Basic leak/functional check only where applicable',
        requirement: 'Drip tray water runoff test clean without pooling; CIP spray nozzles checked for clear spray path',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },

  // 9. FINAL MANUFACTURING INSPECTION / FAT (Factory Acceptance & Workshop Release)
  FINAL_MANUFACTURING_FAT: {
    type: 'FINAL_MANUFACTURING_FAT',
    title: '9. Final Manufacturing Inspection / FAT',
    category: 'Factory Acceptance Release',
    scopeDescription:
      'For the completed machine or major assembly before release from the workshop (Factory release before packing, crating or dispatch).',
    shortDesc: 'Job no, machine ID, drawing revs, components fitted, critical dimensions, workmanship, fasteners, motion, dry cycle, electrical, guards, clean, traceability, prior sheets, zero open NCRs, spares/packing, FAT release',
    points: [
      {
        pointNumber: 1,
        description: 'Correct project/job number',
        requirement: 'Project number and job order verified on production traveler, routing sheet and BOM',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 2,
        description: 'Correct machine/assembly identification',
        requirement: 'Machine stamped with serial number plate, model designation, CE/UKCA mark and date',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 3,
        description: 'Latest drawing revisions',
        requirement: 'All sub-assemblies built and verified against latest released engineering drawings in QMS; completed assembly confirmed',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 4,
        description: 'All required components fitted',
        requirement: '100% of specified components, sensors, brackets, handles, feet, covers & options present',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 5,
        description: 'Critical dimensions verified',
        requirement: 'Machine footprint, infeed/discharge transfer heights, conveyor centers & overall dimensions verified',
        mandatory: true,
        requiresMeasurement: true,
        measurementUnit: 'mm',
        measurementPlaceholder: 'e.g. 1850 L x 920 W x 1420 H mm',
      },
      {
        pointNumber: 6,
        description: 'General workmanship',
        requirement: 'Flawless stainless steel finish; deburred edges, clean weld seams, no scratches, dents or swarf; overall appearance clean',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 7,
        description: 'Fasteners/components complete',
        requirement: 'All fixings torqued, thread protectors, shaft keyways, plugs and locking devices in place and secure',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 8,
        description: 'Moving parts operate correctly',
        requirement: 'Drives test run in workshop; conveyors track correctly; smooth mechanical motion verified',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 9,
        description: 'Basic dry cycle / manual rotation / function check',
        requirement: 'Manual rotation or basic workshop dry run cycle verified successfully under factory conditions',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 10,
        description: 'Electrical panel complete',
        requirement: 'Control panel mounted, field wiring glanded, doors interlocked, schematics placed in door pouch',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 11,
        description: 'Guards/components complete',
        requirement: 'All fixed safety guards, interlocked doors, lexan viewing windows, covers & emergency stops fitted',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 12,
        description: 'Machine clean and free from manufacturing debris',
        requirement: 'Equipment degreased, all swarf, metal shavings, grinding dust vacuumed; clean for food/pharma use',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 13,
        description: 'Traceability complete',
        requirement: 'All serial numbers, motor/gearbox tags, rating plates and drawing revision snapshots logged into QMS dossier',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 14,
        description: 'All prior inspection sheets complete and signed off',
        requirement: 'All prior fabrication, machining, conveyor and assembly inspection sheets signed off in pool',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 15,
        description: 'Outstanding NCRs/deviations reviewed',
        requirement: 'Zero open NCRs; all engineering concession deviations formally approved and documented',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 16,
        description: 'Loose parts/spares accounted for & packing protection checked',
        requirement: 'Loose spares accounted for, transit restraints locked, rust protection applied, ready for workshop release',
        mandatory: true,
        requiresMeasurement: false,
      },
      {
        pointNumber: 17,
        description: 'FAT result: PASS / FAIL',
        requirement: 'Final factory manufacturing acceptance disposition approved before release from workshop',
        mandatory: true,
        requiresMeasurement: false,
      },
    ],
  },
  // Alias for backward compatibility
  FINAL_MANUFACTURING: {
    type: 'FINAL_MANUFACTURING',
    title: '9. Final Manufacturing Inspection / FAT',
    category: 'Factory Acceptance Release',
    scopeDescription:
      'For the completed machine or major assembly before release from the workshop (Factory release before packing, crating or dispatch).',
    shortDesc: 'Job no, machine ID, drawing revs, components fitted, critical dimensions, workmanship, fasteners, motion, dry cycle, electrical, guards, clean, traceability, prior sheets, zero open NCRs, spares/packing, FAT release',
    points: [], // Dynamically mapped below
  },
};

// Map backward compatibility aliases
DALE_PROCESS_DEFINITIONS.MACHINED_PARTS.points = DALE_PROCESS_DEFINITIONS.MACHINED_COMPONENTS.points;
DALE_PROCESS_DEFINITIONS.ASSEMBLY.points = DALE_PROCESS_DEFINITIONS.MECHANICAL_ASSEMBLY.points;
DALE_PROCESS_DEFINITIONS.ELECTRICAL_PANELS.points = DALE_PROCESS_DEFINITIONS.ELECTRICAL_CONTROL_PANEL.points;
DALE_PROCESS_DEFINITIONS.FINAL_MANUFACTURING.points = DALE_PROCESS_DEFINITIONS.FINAL_MANUFACTURING_FAT.points;

// The Canonical Dale Processes
export const DALE_CANONICAL_PROCESS_KEYS: DaleProcessType[] = [
  'FABRICATION_WELDING',
  'MACHINED_COMPONENTS',
  'CONVEYOR_COMPONENTS',
  'SPIRAL_SYSTEMS',
  'MECHANICAL_ASSEMBLY',
  'ELECTRICAL_CONTROL_PANEL',
  'ROBOTIC_AUTOMATION_ASSEMBLY',
  'REFRIGERATION_COOLING_ASSEMBLY',
  'FINAL_MANUFACTURING_FAT',
];

export function getDaleProcessDefinition(processType: DaleProcessType): DaleProcessDefinition {
  return DALE_PROCESS_DEFINITIONS[processType] || DALE_PROCESS_DEFINITIONS.FABRICATION_WELDING;
}

export function getAllDaleProcessDefinitions(): DaleProcessDefinition[] {
  return DALE_CANONICAL_PROCESS_KEYS.map((k) => DALE_PROCESS_DEFINITIONS[k]);
}

/**
 * Returns default inspection points for a process.
 * IMPORTANT: By QMS policy, result starts as null (open-ended). Default PASS is strictly prohibited!
 */
export function getDefaultDalePoints(processType: DaleProcessType): DaleInspectionPoint[] {
  const def = getDaleProcessDefinition(processType);
  if (!def || !def.points) return [];
  return def.points.map((p, idx) => ({
    id: `PT-${processType.slice(0, 3)}-${idx + 1}`,
    pointNumber: p.pointNumber,
    description: p.description,
    requirement: p.requirement,
    mandatory: p.mandatory,
    requiresMeasurement: p.requiresMeasurement,
    measurementUnit: p.measurementUnit,
    result: null, // Open-ended: No default PASS value. Inspector must record active finding.
    measurementValue: '',
    comment: '',
  }));
}

export interface ManufacturedPartContext {
  partNumber: string;
  description: string;
  drawingNumber?: string;
  revision?: string;
  category?: string;
  material?: string;
}

/**
 * Automatically generates a conducive pool of inspection sheets for a specific Project and Machine
 * according to the manufactured equipment type and manufactured parts.
 * strictly restricted to factory manufacturing processes only.
 */
export function generateProjectMachineInspectionPool(params: {
  projectNumber: string;
  machineOrAssembly: string;
  machineSerial: string;
  machineType?: string;
  inspector: string;
  manufacturedParts?: ManufacturedPartContext[];
}): Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>[] {
  const {
    projectNumber,
    machineOrAssembly,
    machineSerial,
    machineType = '',
    inspector,
    manufacturedParts = [],
  } = params;
  const upperType = (machineType || machineOrAssembly).toUpperCase();
  const dateStr = new Date().toISOString().split('T')[0];

  const poolSheets: Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  let sheetIndex = 1;

  // Helper to construct a record
  const buildRecord = (
    pType: DaleProcessType,
    partName: string,
    partNo: string,
    partDesc: string,
    drawingNo: string,
    drawingRev: string
  ): Omit<DaleInspectionRecord, 'id' | 'createdAt' | 'updatedAt'> => {
    const def = getDaleProcessDefinition(pType);
    const sheetNo = `DALE-${projectNumber}-${machineSerial.slice(-4) || '001'}-${String(sheetIndex++).padStart(2, '0')}`;
    return {
      sheetNumber: sheetNo,
      processType: pType,
      processTitle: def.title,
      projectNumber,
      machineOrAssembly,
      partName,
      partOrSerialNo: partNo,
      partDescription: partDesc,
      drawingNumber: drawingNo,
      drawingRevision: drawingRev,
      inspector: inspector || 'Sarah Connor',
      inspectionDate: dateStr,
      points: getDefaultDalePoints(pType),
      comments: `Workshop manufacturing inspection sheet generated for Job ${projectNumber} (${machineOrAssembly}). Factory manufacturing scope only.`,
      ncrReference: 'None',
      correctiveAction: '',
      approvalStatus: 'PENDING',
    };
  };

  // 1. If specific manufactured parts were provided, generate conducive sheets for each part:
  const machinedPartsHandled = new Set<string>();
  const fabricatedPartsHandled = new Set<string>();

  if (manufacturedParts.length > 0) {
    for (const part of manufacturedParts) {
      const cat = (part.category || '').toUpperCase();
      const desc = (part.description || '').toUpperCase();
      const pNum = part.partNumber;
      const dwg = part.drawingNumber || `DWG-${projectNumber}-${pNum.slice(0, 8)}`;
      const rev = part.revision || '0';

      const isMachined =
        ['SHAFT', 'ROLLER', 'SPROCKET', 'GEAR', 'HOUSING', 'BEARING_BLOCK', 'COLLAR', 'PIN'].includes(cat) ||
        desc.includes('SHAFT') ||
        desc.includes('SPROCKET') ||
        desc.includes('ROLLER') ||
        desc.includes('DRUM') ||
        desc.includes('BORE') ||
        desc.includes('MACHIN') ||
        desc.includes('LOCKING PLATE');

      const isFabrication =
        ['FRAME', 'BODY', 'CHUTE', 'BRACKET', 'PLATE', 'STRUCTURE', 'GUARD', 'SUPPORT', 'MOUNT'].includes(cat) ||
        desc.includes('FRAME') ||
        desc.includes('CHUTE') ||
        desc.includes('WELD') ||
        desc.includes('PLATE') ||
        desc.includes('BRACKET') ||
        desc.includes('SUPPORT') ||
        desc.includes('GUIDE') ||
        desc.includes('GUARD') ||
        desc.includes('HOPPER');

      if (isMachined) {
        machinedPartsHandled.add(pNum);
        poolSheets.push(
          buildRecord(
            'MACHINED_COMPONENTS',
            `Machined: ${part.description}`,
            pNum,
            `CNC/lathe turned or milled component: ${part.description}`,
            dwg,
            rev
          )
        );
      } else if (isFabrication) {
        fabricatedPartsHandled.add(pNum);
        poolSheets.push(
          buildRecord(
            'FABRICATION_WELDING',
            `Fabricated: ${part.description}`,
            pNum,
            `Fabricated & welded component: ${part.description}`,
            dwg,
            rev
          )
        );
      }
    }
  }

  // 2. Ensure general machine framework fabrication & welding sheet is present if not already added
  if (fabricatedPartsHandled.size === 0) {
    poolSheets.push(
      buildRecord(
        'FABRICATION_WELDING',
        'Main Fabricated Frame & Welded Body',
        `${machineSerial}-FRM-01`,
        `Main stainless-steel welded structure & frame for ${machineOrAssembly}`,
        `DWG-${projectNumber}-FRM-01`,
        '0'
      )
    );
  }

  // 3. Ensure machined components sheet is present if machine has rotating parts and not already added
  if (machinedPartsHandled.size === 0) {
    poolSheets.push(
      buildRecord(
        'MACHINED_COMPONENTS',
        'Drive Shafts, Sprockets & Precision Machined Parts',
        `${machineSerial}-SFT-01`,
        `Drive shafts, sprockets, rollers & machined journals for ${machineOrAssembly}`,
        `DWG-${projectNumber}-SFT-01`,
        '0'
      )
    );
  }

  // 4. Conveyor Components (conducive to conveyors, feeders, transfer assemblies, dividing conveyors)
  // Only applies if the machine is a conveyor/transfer unit or specifically incorporates conveyor beds
  if (
    upperType.includes('CONVEYOR') ||
    upperType.includes('FEED') ||
    upperType.includes('TRANSFER') ||
    upperType.includes('VIBRATORY')
  ) {
    poolSheets.push(
      buildRecord(
        'CONVEYOR_COMPONENTS',
        'Conveyor Frame, Belt & Transfer Components',
        `${machineSerial}-CNV-01`,
        `Conveyor frames, belts, sprockets, bearings, guides & transfer mechanisms for ${machineOrAssembly}`,
        `DWG-${projectNumber}-CNV-01`,
        '0'
      )
    );
  }

  // 5. Spiral System Components (strictly conducive to spiral freezers, spiral coolers, spiral towers, drums only)
  // MUST NEVER be included for Rounders, Dividers, Conveyors or other non-spiral machinery!
  const isSpiralEquipment =
    (upperType.includes('SPIRAL') ||
      upperType.includes('FREEZER') ||
      upperType.includes('COOLING TOWER') ||
      upperType.includes('SPIRAL DRUM')) &&
    !upperType.includes('ROUNDER') &&
    !upperType.includes('DIVIDER');

  if (isSpiralEquipment) {
    poolSheets.push(
      buildRecord(
        'SPIRAL_SYSTEMS',
        'Spiral Drum, Tier Guides & Tower Structure',
        `${machineSerial}-SPI-01`,
        `Spiral drums, supports, belt tier paths, center drive & cage structure for ${machineOrAssembly}`,
        `DWG-${projectNumber}-SPI-01`,
        '0'
      )
    );
  }

  // 6. Mechanical Assembly (applies to all manufactured mechanical equipment)
  poolSheets.push(
    buildRecord(
      'MECHANICAL_ASSEMBLY',
      'Completed Mechanical Sub-Assembly',
      `${machineSerial}-ASY-01`,
      `Completed mechanical assembly, alignment, torque, moving parts & guards for ${machineOrAssembly}`,
      `DWG-${projectNumber}-ASY-01`,
      '0'
    )
  );

  // 7. Electrical Control Panel (for Dale-manufactured control panels and electrical assemblies)
  poolSheets.push(
    buildRecord(
      'ELECTRICAL_CONTROL_PANEL',
      'Main Electrical Control Panel & Enclosure',
      `${machineSerial}-ELC-01`,
      `Factory-built electrical control panel, wiring, earthing, termination & safety for ${machineOrAssembly}`,
      `DWG-${projectNumber}-ELC-01`,
      '0'
    )
  );

  // 8. Robotic / Automation Assembly (for robots, gantry handling, destackers)
  if (
    upperType.includes('ROBOT') ||
    upperType.includes('AUTOMAT') ||
    upperType.includes('PAN') ||
    upperType.includes('LID') ||
    upperType.includes('DESTACK') ||
    upperType.includes('GANTRY')
  ) {
    poolSheets.push(
      buildRecord(
        'ROBOTIC_AUTOMATION_ASSEMBLY',
        'Robotic Tooling & End-Effector Mechanism',
        `${machineSerial}-ROB-01`,
        `Robot end-effectors, magnetic/vacuum heads, sensors, pneumatics for ${machineOrAssembly}`,
        `DWG-${projectNumber}-ROB-01`,
        '0'
      )
    );
  }

  // 9. Refrigeration / Cooling Components (strictly for spiral freezers, evaporators, chillers, coolers)
  // MUST NEVER be included for Rounders, Dividers, Conveyors or standard handling cells!
  const isRefrigerationEquipment =
    (upperType.includes('FREEZ') ||
      upperType.includes('COOL') ||
      upperType.includes('CHILL') ||
      upperType.includes('REFRIG') ||
      upperType.includes('EVAPORAT')) &&
    !upperType.includes('ROUNDER') &&
    !upperType.includes('DIVIDER');

  if (isRefrigerationEquipment) {
    poolSheets.push(
      buildRecord(
        'REFRIGERATION_COOLING_ASSEMBLY',
        'Cooling Circuit & Evaporator Assembly',
        `${machineSerial}-REF-01`,
        `Cooling/freezing circuit, evaporator enclosure, fan cowlings, CIP spray headers for ${machineOrAssembly}`,
        `DWG-${projectNumber}-REF-01`,
        '0'
      )
    );
  }

  // 10. Factory Acceptance / Workshop Release (FAT) - Final workshop release before packing/dispatch
  poolSheets.push(
    buildRecord(
      'FINAL_MANUFACTURING_FAT',
      'Factory Acceptance / Workshop Release (FAT)',
      machineSerial,
      `Final factory manufacturing acceptance & release sign-off before packing/dispatch for ${machineOrAssembly}`,
      `DWG-${projectNumber}-FAT-01`,
      '0'
    )
  );

  return poolSheets;
}
