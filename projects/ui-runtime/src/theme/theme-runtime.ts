/**
 * SPDX-License-Identifier: Apache-2.0
 * Extracted from alxarafe/erbas-client: app/src/app/core-fe/theme/theme-runtime.ts
 * Source revision: cb7ca1682cdb8c6b253cf038e9daaf1898e02107
 * Modified for the reusable package; see NOTICE for provenance and changes.
 */
import { Injectable, Provider, Type, inject, reflectComponentType, signal } from '@angular/core';
import {
    ThemeArtifact,
    ThemeArtifacts,
    ThemeDefinition,
    ThemeId,
    THEME_ARTIFACTS,
} from './theme-definition.js';
import { FIELD_RENDERER_BINDINGS } from '../field-types/renderer-context.js';

import {
    OptionalControlDefinition,
    ControlResolution,
    ControlRequest,
    snapshotRequest,
    snapshotDomain,
    covers,
} from './optional-controls.js';

import { DefaultFormPresentation } from '../form/default-form-presentation.js';
import type { ThemeComponents } from '../form/form-definition.js';

const STYLE_ID = /^[a-z][a-z0-9-]*$/;
export class ThemeRegistry {
    readonly all: readonly ThemeDefinition[];
    private readonly themes = new Map<string, ThemeDefinition>();
    readonly controls: readonly OptionalControlDefinition[];
    constructor(
        definitions: readonly ThemeDefinition[],
        controls: readonly OptionalControlDefinition[] = [],
    ) {
        const ids = new Set<string>();
        this.controls = Object.freeze(
            controls.map((control) => {
                if (!STYLE_ID.test(control.id) || ids.has(control.id))
                    throw new Error('Invalid or duplicate control identity');
                ids.add(control.id);
                return Object.freeze({
                    id: control.id,
                    domain: snapshotDomain(control.domain),
                    alternatives: Object.freeze([...(control.alternatives ?? [])]),
                });
            }),
        );
        const checked = new Set<string>();
        const visit = (id: string, path: readonly string[]): void => {
            if (path.includes(id)) throw new Error('Control alternative cycle');
            if (checked.has(id)) return;
            const control = this.controls.find((item) => item.id === id);
            if (!control) throw new Error('Unknown control alternative');
            for (const next of control.alternatives ?? []) visit(next, [...path, id]);
            checked.add(id);
        };
        for (const id of ids) visit(id, []);
        for (const definition of definitions) {
            if (
                !STYLE_ID.test(definition.id) ||
                !STYLE_ID.test(definition.cssClass) ||
                this.themes.has(definition.id)
            )
                throw new Error('Invalid or duplicate theme identity');
            const overrides = { ...definition.overrides };
            for (const [key, component] of Object.entries(overrides)) {
                if (
                    !THEME_ARTIFACTS.includes(key as ThemeArtifact) ||
                    typeof component !== 'function'
                )
                    throw new Error('Unknown or invalid theme artifact');
                const mirror = reflectComponentType(component as Type<unknown>);
                if (!mirror?.isStandalone)
                    throw new Error('Theme artifacts must be compiled standalone components');
                if (
                    key.startsWith('field.') &&
                    (!mirror.inputs.some(
                        (input) => input.templateName === FIELD_RENDERER_BINDINGS.context,
                    ) ||
                        !mirror.outputs.some(
                            (output) => output.templateName === FIELD_RENDERER_BINDINGS.valueChange,
                        ))
                )
                    throw new Error('Invalid field renderer contract');
            }
            const components = { ...definition.components };
            for (const [key, component] of Object.entries(components)) {
                const mirror =
                    typeof component === 'function' ? reflectComponentType(component) : null;
                if (
                    key !== 'form' ||
                    !mirror?.isStandalone ||
                    !mirror.inputs.some((input) => input.templateName === 'context') ||
                    mirror.ngContentSelectors.length !== 1 ||
                    mirror.ngContentSelectors[0] !== '*'
                )
                    throw new Error('Invalid form presentation contract');
            }
            const optional = Object.fromEntries(
                Object.entries(definition.controls ?? {}).map(([id, renderer]) => {
                    if (!ids.has(id)) throw new Error('Unknown optional control');
                    const mirror =
                        typeof renderer?.component === 'function'
                            ? reflectComponentType(renderer.component)
                            : null;
                    if (
                        !mirror?.isStandalone ||
                        !mirror.inputs.some(
                            (input) => input.templateName === FIELD_RENDERER_BINDINGS.context,
                        ) ||
                        !mirror.outputs.some(
                            (output) => output.templateName === FIELD_RENDERER_BINDINGS.valueChange,
                        )
                    )
                        throw new Error('Invalid optional control renderer contract');
                    if (
                        renderer.capabilities !== undefined &&
                        typeof renderer.capabilities !== 'function'
                    )
                        throw new Error('Invalid optional control capabilities');
                    return [
                        id,
                        Object.freeze({
                            component: renderer.component,
                            domain: snapshotDomain(renderer.domain),
                            ...(renderer.capabilities === undefined
                                ? {}
                                : { capabilities: renderer.capabilities }),
                        }),
                    ];
                }),
            );
            this.themes.set(
                definition.id,
                Object.freeze({
                    ...definition,
                    overrides: Object.freeze(overrides),
                    controls: Object.freeze(optional),
                    components: Object.freeze(components),
                }),
            );
        }
        const fallback = this.themes.get(ThemeId.Default);
        if (!fallback || THEME_ARTIFACTS.some((artifact) => !fallback.overrides[artifact]))
            throw new Error('Default theme must provide every artifact');
        this.all = Object.freeze(
            [...this.themes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
        );
    }
    find(id: string): ThemeDefinition | undefined {
        return this.themes.get(id);
    }
    require(id: string): ThemeDefinition {
        const theme = this.find(id);
        if (!theme) throw new Error('Unknown theme');
        return theme;
    }
}
@Injectable()
export class ThemeService {
    private readonly registry = inject(ThemeRegistry);
    private readonly selection = signal(this.registry.require(ThemeId.Default));
    readonly current = this.selection.asReadonly();
    activate(id: string): boolean {
        const theme = this.registry.find(id);
        this.selection.set(theme ?? this.registry.require(ThemeId.Default));
        return theme !== undefined;
    }
}
@Injectable()
export class ThemeResolver {
    private readonly registry = inject(ThemeRegistry);
    private readonly service = inject(ThemeService);
    resolveComponent<K extends keyof ThemeComponents>(key: K): ThemeComponents[K] {
        if (key !== 'form') throw new Error('Unknown theme component');
        return (this.service.current().components?.form ??
            this.registry.require(ThemeId.Default).components?.form ??
            DefaultFormPresentation) as ThemeComponents[K];
    }
    resolveControl(id: string, instance?: ControlRequest): ControlResolution {
        const requested = this.registry.controls.find((control) => control.id === id);
        if (!requested) throw new Error('Unknown optional control');
        const request = snapshotRequest(
            instance === undefined ? { domain: requested.domain } : instance,
        );
        if (request.domain.semantic !== requested.domain.semantic)
            throw new Error('Incompatible control semantics');
        const ordered: string[] = [];
        const visit = (key: string): void => {
            if (ordered.includes(key)) return;
            ordered.push(key);
            for (const next of this.registry.controls.find((control) => control.id === key)!
                .alternatives ?? [])
                visit(next);
        };
        visit(id);
        for (const theme of [this.service.current(), this.registry.require(ThemeId.Default)]) {
            for (const key of ordered) {
                const definition = this.registry.controls.find((control) => control.id === key)!;
                const renderer =
                    theme.controls && Object.hasOwn(theme.controls, key)
                        ? theme.controls[key]
                        : undefined;
                if (
                    !renderer ||
                    definition.domain.semantic !== request.domain.semantic ||
                    (!instance && !covers(definition.domain, request.domain))
                )
                    continue;
                const capability = renderer.capabilities
                    ? renderer.capabilities(request)
                    : Object.keys(request.presentation ?? {}).length
                      ? undefined
                      : renderer.domain;
                if (capability !== undefined && covers(snapshotDomain(capability), request.domain))
                    return Object.freeze({
                        component: renderer.component,
                        control: key,
                        theme: theme.id,
                    });
            }
        }
        throw new Error('No compatible optional control representation');
    }
    resolve<K extends ThemeArtifact>(artifact: K): ThemeArtifacts[K] {
        if (!THEME_ARTIFACTS.includes(artifact)) throw new Error('Unknown theme artifact');
        const component =
            this.service.current().overrides[artifact] ??
            this.registry.require(ThemeId.Default).overrides[artifact];
        if (!component) throw new Error('Missing theme artifact');
        return component as ThemeArtifacts[K];
    }
}
// App-scoped providers keep selection local and make isolated test compositions easy.
export function provideThemeRuntime(
    themes: readonly ThemeDefinition[],
    controls: readonly OptionalControlDefinition[] = [],
): Provider[] {
    return [
        { provide: ThemeRegistry, useFactory: () => new ThemeRegistry(themes, controls) },
        ThemeService,
        ThemeResolver,
    ];
}
