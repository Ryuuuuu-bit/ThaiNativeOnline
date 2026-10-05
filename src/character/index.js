// Character system public API (see docs/INTERFACES.md, "Character").
export { createPlayer } from './model.js';
export { createMovementController } from './movement.js';
export {
  CLASSES, DEFAULT_CLASS_ID, listClassIds, hasClass, getClass, getClassStats, validateClass, validateAllClasses,
} from './classes.js';
