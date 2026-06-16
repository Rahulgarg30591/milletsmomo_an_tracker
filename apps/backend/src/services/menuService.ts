import { buildMenu } from '../constants/menu.js';

export function getMenu() {
  return { items: buildMenu() };
}
