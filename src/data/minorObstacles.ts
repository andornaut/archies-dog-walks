import type { MinorObstacle } from "./types.ts";

// Obstacles that open no card. Shapes are lanes across by rows along the road; each zone
// weighs how often they appear there, in world.ts, and one appears only where weighed above 0.
// An obstacle has one look everywhere, or, with skins, a look per neighbourhood: each spawn picks
// one of its zone's skins evenly. An obstacle with a movement comes as a mover at the zone's mover
// share, and stands still otherwise. onFoot marks a person or an animal, not a vehicle or a thing.
// One with contact acts as a puddle does, its effects in place of a bump's.
export const MINOR_OBSTACLES = {
  artSculpture: {
    name: "Crate stack",
    shape: { lanes: 1, rows: 1 },
  },
  ball: {
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0 },
    name: "Ball",
    shape: { lanes: 1, rows: 1 },
  },
  barrelStack: {
    contact: { effects: [{ debuff: "stinky", kind: "debuff" }] },
    name: "Barrel stack",
    shape: { lanes: 1, rows: 1 },
  },
  beachUmbrella: {
    name: "Beach umbrella",
    shape: { lanes: 1, rows: 1 },
  },
  bench: { name: "Bench", shape: { lanes: 2, rows: 1 } },
  breweryDray: {
    movement: {
      kind: "stopAndGoAcross",
      speed: 0.5,
      stopSeconds: 1.3,
      stops: [
        [0, 2],
        [1, 3],
        [2, 4],
      ],
    },
    name: "Brewery dray",
    shape: { lanes: 3, rows: 1 },
  },
  bunny: {
    movement: { kind: "hop", most: 2, shy: true, times: { max: 5, min: 2 } },
    name: "Bunny",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  busker: {
    name: "Busker",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  car: {
    movement: { factor: 2.3, kind: "inLane" },
    name: "Car",
    shape: { lanes: 1, rows: 3 },
  },
  cargoBike: {
    movement: { factor: 1.3, kind: "inLane" },
    name: "Cargo bike",
    shape: { lanes: 1, rows: 2 },
  },
  cat: {
    movement: { kind: "dart", stopShare: 0.5, tilt: { max: 1.6, min: 0.1 }, turnBackShare: 0.33 },
    name: "Cat",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  cherryTrees: { name: "Cherry trees", shape: { lanes: 3, rows: 1 } },
  clothingRack: {
    name: "Clothing rack",
    shape: { lanes: 1, rows: 1 },
  },
  couple: {
    movement: { kind: "sway", pauseSeconds: 0.25, times: { max: 3, min: 2 } },
    name: "Couple",
    onFoot: true,
    shape: { lanes: 2, rows: 1 },
  },
  coyote: {
    movement: { kind: "approach", steps: { max: 4, min: 3 } },
    name: "Coyote",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  crosstownBus: {
    movement: {
      kind: "stopAndGoAcross",
      speed: 0.65,
      stopSeconds: 1,
      stops: [
        [0, 2],
        [1, 3],
        [2, 4],
      ],
    },
    name: "Crosstown bus",
    shape: { lanes: 3, rows: 1 },
  },
  cyclist: {
    movement: { factor: 2.0, kind: "inLane" },
    name: "Cyclist",
    shape: { lanes: 1, rows: 1 },
  },
  deliveryCyclist: {
    movement: { factor: 1.8, kind: "merge", mergeAt: 0.4, mergeSeconds: 0.4 },
    name: "Delivery cyclist",
    shape: { lanes: 1, rows: 1 },
  },
  deliveryTruck: {
    movement: { factor: 1.6, kind: "inLane" },
    name: "Delivery truck",
    shape: { lanes: 1, rows: 3 },
  },
  ducklings: {
    movement: { kind: "follow", pauseSeconds: 0.6, steps: { max: 3, min: 2 } },
    name: "Ducklings",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  escapedCapybara: {
    movement: { kind: "step", steps: { max: 2, min: 1 } },
    name: "Escaped capybara",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  fallenLog: { name: "Fallen log", shape: { lanes: 2, rows: 1 } },
  ferrets: {
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0.3 },
    name: "Ferrets",
    onFoot: true,
    shape: { lanes: 2, rows: 1 },
  },
  foodCartVendor: {
    movement: {
      factor: 0.7,
      goSeconds: 0.5,
      kind: "stopAndGo",
      stopSeconds: 0.6,
      stops: { max: 3, min: 2 },
    },
    name: "Food cart vendor",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  frisbeeDog: {
    contact: { effects: [{ debuff: "zoomies", kind: "debuff" }] },
    movement: { kind: "dive", slide: 0.4, speed: 1, tilt: { max: 1.6, min: 0.1 } },
    name: "Frisbee dog",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  garbageTruck: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Garbage truck",
    shape: { lanes: 1, rows: 3 },
  },
  gardener: {
    movement: {
      factor: 0.7,
      goSeconds: 0.5,
      kind: "stopAndGo",
      stopSeconds: 0.6,
      stops: { max: 3, min: 2 },
    },
    name: "Gardener",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  goose: {
    movement: { factor: 2.07, kind: "inLane" },
    name: "Goose",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  grannyCartShopper: {
    movement: { kind: "step", steps: { max: 4, min: 3 } },
    name: "Granny cart shopper",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  hedge: {
    name: "Hedge",
    shape: { lanes: 3, rows: 1 },
  },
  hen: {
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0, min: 0 }, turnBackShare: 0 },
    name: "Hen",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  hopscotchKid: {
    movement: { hops: { max: 4, min: 2 }, kind: "bounce", pauseSeconds: 0.6 },
    name: "Hopscotch kid",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  iceCreamBike: {
    movement: {
      factor: 0.7,
      goSeconds: 0.5,
      kind: "stopAndGo",
      stopSeconds: 0.6,
      stops: { max: 3, min: 2 },
    },
    name: "Ice cream bike",
    shape: { lanes: 1, rows: 1 },
  },
  iceCreamTruck: {
    movement: { factor: 0.7, kind: "inLane" },
    name: "Ice cream truck",
    shape: { lanes: 1, rows: 3 },
  },
  ironFence2: { name: "Iron fence", shape: { lanes: 2, rows: 1 } },
  ironFence3: { name: "Iron fence", shape: { lanes: 3, rows: 1 } },
  jogger: {
    movement: { factor: 1.7, kind: "inLane" },
    name: "Jogger",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  kegDollyWorker: {
    movement: {
      factor: 0.7,
      goSeconds: 0.5,
      kind: "stopAndGo",
      stopSeconds: 0.6,
      stops: { max: 3, min: 2 },
    },
    name: "Keg dolly worker",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  kidOnABike: {
    movement: { factor: 1.35, kind: "inLane" },
    name: "Kid on a bike",
    shape: { lanes: 1, rows: 1 },
  },
  leafBag: { name: "Leaf bag", shape: { lanes: 1, rows: 1 } },
  lifeguardChair: {
    name: "Lifeguard chair",
    shape: { lanes: 1, rows: 1 },
  },
  littleFreeLibrary: {
    name: "Little Free Library",
    shape: { lanes: 1, rows: 1 },
  },
  mailCarrier: {
    movement: { kind: "step", steps: { max: 4, min: 3 } },
    name: "Mail carrier",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  marketStall2: { name: "Market stall", shape: { lanes: 2, rows: 1 } },
  marketStall3: { name: "Market stall", shape: { lanes: 3, rows: 1 } },
  newspaperBox: { name: "Newspaper box", shape: { lanes: 1, rows: 1 } },
  parkRangersCart: {
    movement: {
      factor: 0.7,
      goSeconds: 0.5,
      kind: "stopAndGo",
      stopSeconds: 0.6,
      stops: { max: 3, min: 2 },
    },
    name: "Park ranger's cart",
    shape: { lanes: 1, rows: 1 },
  },
  parkedCar: { name: "Parked car", shape: { lanes: 1, rows: 3 } },
  patrolBuggy: {
    movement: {
      kind: "stopAndGoAcross",
      speed: 0.7,
      stopSeconds: 1.3,
      stops: [
        [1, 2],
        [2, 3],
      ],
    },
    name: "Patrol buggy",
    shape: { lanes: 2, rows: 1 },
  },
  pedicab: {
    movement: { factor: 1.2, kind: "inLane" },
    name: "Pedicab",
    shape: { lanes: 1, rows: 2 },
  },
  pigeons: {
    movement: { kind: "dart", stopShare: 0, tilt: { max: -0.3, min: -0.3 }, turnBackShare: 0 },
    name: "Pigeons",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  porchSteps: { name: "Porch steps", shape: { lanes: 1, rows: 1 } },
  produceCrates: {
    name: "Produce crates",
    shape: { lanes: 1, rows: 1 },
  },
  raccoon: {
    movement: { kind: "approach", steps: { max: 3, min: 2 } },
    name: "Raccoon",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  rollerblader: {
    movement: { factor: 2.0, kind: "inLane" },
    name: "Rollerblader",
    shape: { lanes: 1, rows: 1 },
  },
  rollingBarrel: {
    movement: { kind: "dart", stopShare: 0, tilt: { max: 0.5, min: 0 }, turnBackShare: 0 },
    name: "Rolling barrel",
    shape: { lanes: 1, rows: 1 },
  },
  sandcastle: { name: "Sandcastle", shape: { lanes: 1, rows: 1 } },
  scooter: {
    movement: { factor: 2.0, kind: "inLane" },
    name: "Scooter",
    shape: { lanes: 1, rows: 1 },
  },
  seagull: {
    contact: { effects: [{ debuff: "stinky", kind: "debuff" }] },
    movement: { kind: "dart", stopShare: 0, tilt: { max: 1.6, min: 0.1 }, turnBackShare: 0.33 },
    name: "Seagull",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  segwayTourRider: {
    movement: { factor: 1.1, kind: "inLane" },
    name: "Segway tour rider",
    shape: { lanes: 1, rows: 1 },
  },
  signSpinner: {
    contact: { effects: [{ debuff: "zoomies", kind: "debuff" }] },
    movement: { hops: { max: 4, min: 2 }, kind: "bounce", pauseSeconds: 0.6 },
    name: "Sign spinner",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  stiltWalker: {
    contact: { effects: [{ debuff: "spotlight", kind: "debuff" }] },
    movement: { kind: "sway", pauseSeconds: 0.25, times: { max: 3, min: 2 } },
    name: "Stilt walker",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  streetCart: {
    shape: { lanes: 2, rows: 1 },
    skins: {
      flowerCart: { name: "Flower cart", zones: ["cabbagetown"] },
      fruitCart: { name: "Fruit cart", zones: ["kensingtonMarket"] },
      hotDogCart: { name: "Hot dog cart", zones: ["highPark", "kensingtonMarket"] },
      iceCreamCart: { name: "Ice cream cart", zones: ["distilleryDistrict", "theBeaches"] },
      newspaperCart: { name: "Newspaper cart", zones: ["yongeStreet"] },
    },
  },
  streetcar: {
    movement: { factor: 0.7, kind: "inLane" },
    name: "Streetcar",
    shape: { lanes: 1, rows: 3 },
  },
  streetcarPlatform: {
    name: "Streetcar platform",
    shape: { lanes: 3, rows: 1 },
  },
  stroller: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "Stroller",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  strollingBusker: {
    movement: { kind: "sway", pauseSeconds: 0.25, times: { max: 3, min: 2 } },
    name: "Strolling busker",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  taxi: {
    movement: { factor: 1.6, kind: "merge", mergeAt: 0.4, mergeSeconds: 0.5 },
    name: "Taxi",
    shape: { lanes: 1, rows: 2 },
  },
  tourGroup: {
    movement: { kind: "follow", pauseSeconds: 0.6, steps: { max: 2, min: 1 } },
    name: "Tour group",
    onFoot: true,
    shape: { lanes: 2, rows: 1 },
  },
  tourist: {
    movement: { kind: "step", steps: { max: 4, min: 2 } },
    name: "Tourist",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
  touristTrain: {
    movement: {
      herringShare: "touristTrainHerringShare",
      kind: "stopAndGoAcross",
      speed: 0.55,
      stopSeconds: 1.6,
      stops: [
        [0, 2],
        [1, 3],
        [2, 4],
      ],
    },
    name: "Tourist train",
    shape: { lanes: 3, rows: 1 },
  },
  trashCan: {
    contact: { effects: [{ debuff: "stinky", kind: "debuff" }] },
    name: "Trash can",
    shape: { lanes: 1, rows: 1 },
  },
  ttcBus: {
    movement: { factor: 0.6, kind: "inLane" },
    name: "TTC bus",
    shape: { lanes: 1, rows: 3 },
  },
  velvetRope: { name: "Velvet rope", shape: { lanes: 2, rows: 1 } },
  volleyballNet3: {
    name: "Volleyball net",
    shape: { lanes: 3, rows: 1 },
  },
  volleyballPlayer: {
    movement: { kind: "dive", slide: 0.4, speed: 1.5, tilt: { max: 0.3, min: 0 } },
    name: "Volleyball player",
    onFoot: true,
    shape: { lanes: 1, rows: 1 },
  },
} as const satisfies Record<string, MinorObstacle>;
