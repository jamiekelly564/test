import { tiers, surveyModules, priorities, actionStatuses, reviewStatuses } from '../../packages/domain/catalog.mjs';
export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const fail = (message, status = 400) => { throw new HttpError(status, message); };
export function text(value, name, max = 500, required = true) {
  if (value === undefined || value === null) { if (required) fail(`${name} is required.`); return ''; }
  if (typeof value !== 'string') fail(`${name} must be text.`);
  const result = value.trim();
  if (required && !result) fail(`${name} is required.`);
  if (result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) fail(`${name} is too long or contains unsupported characters.`);
  return result;
}
export function normalisePostcode(value) {
  const raw = text(value, 'Postcode', 12).toUpperCase().replace(/\s/g, '');
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(raw)) fail('Enter a complete UK postcode, for example RH2 9QQ.');
  return `${raw.slice(0, -3)} ${raw.slice(-3)}`;
}
export function choice(value, name, choices) { if (!choices.includes(value)) fail(`Invalid ${name}.`); return value; }
export function record(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a JSON object.'); return value; }
export function buildingInput(input) {
  const b = record(input);
  return { name: text(b.name, 'Building name', 150), postcode: normalisePostcode(b.postcode), address: text(b.address, 'Address', 400, false) };
}
export function surveyInput(input) {
  const b = record(input), tier = choice(b.tier, 'package', tiers.map(t => t.id));
  if (!Array.isArray(b.modules) || !b.modules.length || b.modules.length > surveyModules.length) fail('Choose at least one inspection module.');
  const modules = [...new Set(b.modules.map(id => choice(id, 'inspection module', surveyModules.map(m => m.id))))];
  const date = text(b.preferredDate, 'Preferred date', 10, false);
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date < new Date().toISOString().slice(0, 10))) fail('Choose a valid future preferred date.');
  const requestKey = text(b.requestKey, 'Request key', 50);
  if (!/^[a-zA-Z0-9-]{12,50}$/.test(requestKey)) fail('Invalid request key.');
  return { tier, modules, coverage: text(b.coverage, 'Survey scope', 3000), preferredDate: date, notes: text(b.notes, 'Notes', 4000, false), requestKey };
}
export function taskInput(input) {
  const b = record(input);
  return { title: text(b.title, 'Task title', 180), description: text(b.description, 'Description', 4000, false), priority: choice(b.priority || 'normal', 'priority', priorities), locationId: text(b.locationId, 'Location', 120, false) || null };
}
export function taskPatch(input) {
  const b = record(input);
  if (!Number.isSafeInteger(b.version) || b.version < 1) fail('A valid record version is required.');
  return { status: choice(b.status, 'task status', actionStatuses), version: b.version };
}
export function locationPatch(input) {
  const b = record(input);
  if (!Number.isSafeInteger(b.version) || b.version < 1) fail('A valid record version is required.');
  return { notes: text(b.notes, 'Notes', 8000, false), reviewStatus: choice(b.reviewStatus, 'review status', reviewStatuses), version: b.version };
}
export function filenameInput(value) {
  const name = text(value, 'Filename', 180);
  if (/[\\/]/.test(name) || name === '.' || name === '..') fail('Invalid filename.');
  return name;
}
