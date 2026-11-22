/** SPDX-License-Identifier: Apache-2.0 */
import { THEME_ARTIFACTS } from '../theme/theme-definition.js';
import type { ContextAction, FormDefinition, FormDiagnostic, FormField, FormLayout, LayoutGroup, LayoutSection, LayoutTab, ValuePath } from './form-definition.js';

export interface ComposedGroup extends Omit<LayoutGroup, 'fields'> { readonly fields: readonly FormField[] }
export interface ComposedSection extends Omit<LayoutSection, 'groups' | 'actions'> { readonly groups: readonly ComposedGroup[]; readonly actions: readonly ContextAction[] }
export interface ComposedTab extends Omit<LayoutTab, 'sections' | 'actions'> { readonly sections: readonly ComposedSection[]; readonly actions: readonly ContextAction[] }
export interface FormComposition {
  readonly tabs: readonly ComposedTab[];
  readonly unplaced: readonly FormField[];
  readonly actions: readonly ContextAction[];
  readonly diagnostics: readonly FormDiagnostic[];
}
function identity(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid form identity');
}
export function formPathKey(path: ValuePath): string {
  if (!Array.isArray(path) || !path.length) throw new Error('Invalid field path');
  for (const segment of path) {
    if (!segment || (segment.kind !== 'property' && segment.kind !== 'row')) throw new Error('Invalid field path');
    identity(segment.kind === 'property' ? segment.name : segment.key);
  }
  return JSON.stringify(path.map(segment => segment.kind === 'property' ? ['property', segment.name] : ['row', segment.key]));
}
function distinct<T extends { readonly id: string }>(items: readonly T[]): void {
  if (!Array.isArray(items)) throw new Error('Invalid form collection');
  const ids = new Set<string>();
  for (const item of items) {
    identity(item?.id);
    if (ids.has(item.id)) throw new Error('Duplicate form identity');
    ids.add(item.id);
  }
}
/** First valid placement wins. Invalid references diagnose, never suppress fallback. */
export function composeForm(definition: FormDefinition, layout?: FormLayout): FormComposition {
  identity(definition.id); identity(definition.label);
  distinct(definition.fields); distinct(definition.actions ?? []);
  const fields = new Map<string, FormField>();
  for (const field of definition.fields) {
    const key = formPathKey(field.path);
    if (fields.has(key)) throw new Error('Duplicate field path');
    if (!field.artifact.startsWith('field.') || !THEME_ARTIFACTS.includes(field.artifact)) throw new Error('Invalid field artifact');
    if (field.excluded !== undefined && typeof field.excluded !== 'boolean') throw new Error('Invalid field exclusion');
    fields.set(key, Object.freeze({ ...field, path: Object.freeze(field.path.map(segment => Object.freeze({ ...segment }))) }));
  }
  const actions = new Map((definition.actions ?? []).map(action => {
    identity(action.label);
    if (typeof action.enabled !== 'boolean') throw new Error('Invalid action state');
    return [action.id, Object.freeze({ ...action })] as const;
  }));
  const placed = new Set<string>(), usedActions = new Set<string>(), diagnostics: FormDiagnostic[] = [];
  const placeFields = (paths: readonly ValuePath[]): readonly FormField[] => Object.freeze(paths.flatMap(path => {
    const key = formPathKey(path), field = fields.get(key);
    const code = !field ? 'unknown-field' : field.excluded ? 'excluded-field' : placed.has(key) ? 'duplicate-field' : undefined;
    if (code) { diagnostics.push(Object.freeze({ code, path: Object.freeze(path.map(segment => Object.freeze({ ...segment }))) })); return []; }
    placed.add(key); return [field!];
  }));
  const placeActions = (refs: readonly { readonly id: string }[]): readonly ContextAction[] => Object.freeze(refs.flatMap(ref => {
    identity(ref.id);
    const action = actions.get(ref.id);
    const code = !action ? 'unknown-action' : usedActions.has(ref.id) ? 'duplicate-action' : undefined;
    if (code) { diagnostics.push(Object.freeze({ code, id: ref.id })); return []; }
    usedActions.add(ref.id); return [action!];
  }));
  const rootActions = [...placeActions(layout?.actions ?? [])];
  distinct(layout?.tabs ?? []);
  const tabs = (layout?.tabs ?? []).map(tab => {
    distinct(tab.sections);
    const tabActions = placeActions(tab.actions);
    const sections = tab.sections.map(section => {
      if (typeof section.collapsible !== 'boolean' || typeof section.initiallyCollapsed !== 'boolean' ||
          (!section.collapsible && section.initiallyCollapsed)) throw new Error('Invalid section collapse state');
      distinct(section.groups);
      return Object.freeze({ ...section, actions: placeActions(section.actions), groups: Object.freeze(section.groups.map(group =>
        Object.freeze({ ...group, fields: placeFields(group.fields) }))) });
    });
    return Object.freeze({ ...tab, actions: tabActions, sections: Object.freeze(sections) });
  });
  rootActions.push(...[...actions.values()].filter(action => !usedActions.has(action.id)));
  return Object.freeze({ tabs: Object.freeze(tabs),
    unplaced: Object.freeze([...fields].filter(([key, field]) => !field.excluded && !placed.has(key)).map(([, field]) => field)),
    actions: Object.freeze(rootActions), diagnostics: Object.freeze(diagnostics) });
}
