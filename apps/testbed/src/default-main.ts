import {
    OptionalEditorTestbed,
    OPTIONAL_EDITOR_THEMES,
    OPTIONAL_EDITOR_CONTROLS,
} from './optional-editor';
import { ScalarEditorTestbed } from './scalar-editor';
import { IntegratedTestbed } from './integrated';
import { ListPortsTestbed } from './list-ports';
import { FeedbackTestbed } from './feedback';
import { FormSlotsTestbed } from './form-slots';
import { EditorTestbed } from './editor';
import { SelectorTestbed } from './selector';
import { MenusTestbed, MENU_THEMES } from './menus';
import { DocumentProtectionTestbed } from './document-protection';
import { DocumentSaveTestbed } from './document-save';
import { StateTestbed } from './state';
import { ValidationTestbed } from './validation';
import { DocumentValidationTestbed } from './document-validation';
import { FormTestbed, FORM_THEMES, FORM_CONTROLS } from './form';
import { GridTestbed, GRID_THEMES } from './grid';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { NavigationTestbed } from './navigation';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

const save = new URLSearchParams(location.search).get('scenario') === 'document-save';
const form = new URLSearchParams(location.search).get('scenario') === 'form';
const state = new URLSearchParams(location.search).get('scenario') === 'state';
const validation = new URLSearchParams(location.search).get('scenario') === 'validation';
const documentValidation =
    new URLSearchParams(location.search).get('scenario') === 'document-validation';
const grid = new URLSearchParams(location.search).get('scenario') === 'grid';
const menus = new URLSearchParams(location.search).get('scenario') === 'menus';
const editor = new URLSearchParams(location.search).get('scenario') === 'editor';
const selector = new URLSearchParams(location.search).get('scenario') === 'selector';
const slots = new URLSearchParams(location.search).get('scenario') === 'form-slots';
const feedback = new URLSearchParams(location.search).get('scenario') === 'feedback';
const listPorts = new URLSearchParams(location.search).get('scenario') === 'list-ports';
const optionalEditor = new URLSearchParams(location.search).get('scenario') === 'optional-editor';
const scalarEditor = new URLSearchParams(location.search).get('scenario') === 'scalar-editor';
const integrated = new URLSearchParams(location.search).get('scenario') === 'integrated';
bootstrapApplication(
    integrated
        ? IntegratedTestbed
        : listPorts
          ? ListPortsTestbed
          : feedback
            ? FeedbackTestbed
            : slots
              ? FormSlotsTestbed
              : selector
                ? SelectorTestbed
                : editor || scalarEditor || optionalEditor
                  ? optionalEditor
                      ? OptionalEditorTestbed
                      : scalarEditor
                        ? ScalarEditorTestbed
                        : EditorTestbed
                  : menus
                    ? MenusTestbed
                    : new URLSearchParams(location.search).get('scenario') === 'document-protection'
                      ? DocumentProtectionTestbed
                      : save
                        ? DocumentSaveTestbed
                        : documentValidation
                          ? DocumentValidationTestbed
                          : validation
                            ? ValidationTestbed
                            : state
                              ? StateTestbed
                              : grid
                                ? GridTestbed
                                : form
                                  ? FormTestbed
                                  : new URLSearchParams(location.search).get('scenario') ===
                                      'navigation'
                                    ? NavigationTestbed
                                    : DefaultThemeTestbed,
    {
        providers: provideThemeRuntime(
            optionalEditor
                ? OPTIONAL_EDITOR_THEMES
                : menus
                  ? MENU_THEMES
                  : grid ||
                      state ||
                      validation ||
                      documentValidation ||
                      save ||
                      editor ||
                      selector ||
                      slots ||
                      feedback ||
                      listPorts ||
                      integrated ||
                      scalarEditor
                    ? GRID_THEMES
                    : form
                      ? FORM_THEMES
                      : DEFAULT_PACKAGE_THEMES,
            optionalEditor
                ? OPTIONAL_EDITOR_CONTROLS
                : grid ||
                    form ||
                    state ||
                    validation ||
                    documentValidation ||
                    save ||
                    editor ||
                    selector ||
                    slots ||
                    feedback ||
                    listPorts ||
                    integrated ||
                    scalarEditor
                  ? FORM_CONTROLS
                  : [],
        ),
    },
).catch((error) => {
    console.error(error);
    throw error;
});
