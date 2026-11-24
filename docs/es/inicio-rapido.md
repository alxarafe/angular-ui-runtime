# Angular UI Runtime (AUR): guía rápida

**Angular UI Runtime (AUR)** es una biblioteca reutilizable de interfaz de usuario para Angular. Es independiente del backend, la base de datos y la aplicación que la utilice. Incluye resolución de temas, composición de formularios y rejillas, gestión inmutable de cambios y validación local de datos.

La distribución técnica se realiza mediante paquetes **Angular Package Format (APF)**. El motor y cada tema son paquetes separados. Una aplicación decide cuáles instalar, qué componentes utilizar y cómo conectar los datos y servicios propios.

> **Estado actual:** versión experimental. El motor declara `0.3.0-alpha.3` y los temas `0.1.0-alpha.3`. Hay cambios posteriores sin incremento de versión. Los paquetes siguen siendo privados y no están publicados en npm. No debe interpretarse como una versión 1.0 completa.

## Requisitos para compilar AUR

- Git, Bash y Docker Engine en funcionamiento.
- Conexión a Internet para descargar imágenes y dependencias durante la primera ejecución.
- No hace falta instalar Node.js, npm ni Angular CLI en el equipo que compila AUR: los scripts los ejecutan en contenedores efímeros.

Las aplicaciones consumidoras deben utilizar Angular 22 y un entorno de compilación compatible.

## Compilar y probar

Desde la raíz del repositorio AUR:

```bash
./bin/test       # Pruebas unitarias y de contratos
./bin/check      # Comprobación completa: compilación, paquetes, consumidor y Chromium
./bin/pack       # Generación de los seis paquetes .tgz
./bin/testbed    # Vista de pruebas en http://127.0.0.1:4173
```

El visor se detiene con Ctrl+C. Es un entorno de pruebas de la biblioteca, no una aplicación distribuida. Los paquetes generados se guardan en `artifacts/`; no se publican automáticamente.

## Instalarla en una aplicación Angular

Copiar a una carpeta de la aplicación, por ejemplo `vendor/aur/`, al menos estos dos paquetes generados:

```text
alxarafe-ui-runtime-0.3.0-alpha.3.tgz
alxarafe-ui-theme-default-0.1.0-alpha.3.tgz
```

En la raíz de la aplicación Angular 22, utilizando su entorno habitual de npm:

```bash
npm install --strict-peer-deps \
  ./vendor/aur/alxarafe-ui-runtime-0.3.0-alpha.3.tgz \
  ./vendor/aur/alxarafe-ui-theme-default-0.1.0-alpha.3.tgz
```

No es necesario instalar el tema visual suministrado si la aplicación aporta otra implementación completa y compatible del tema `default`. Los temas adicionales se instalan mediante sus `.tgz` correspondientes; no se activan automáticamente.

## Configurar el tema

```ts
import { ApplicationConfig } from '@angular/core';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME } from '@alxarafe/ui-theme-default';

export const appConfig: ApplicationConfig = {
    providers: [...provideThemeRuntime([DEFAULT_THEME])],
};
```

Importar una sola vez la hoja de estilo en los estilos globales de la aplicación:

```css
@import '@alxarafe/ui-theme-default/theme.css';
```

Para añadir el tema de alto contraste, instalar `@alxarafe/ui-theme-high-contrast`, importar `HIGH_CONTRAST_THEME`, registrarlo junto con `DEFAULT_THEME` y cargar su `theme.css` después del CSS de `default`.

El registro de temas **no crea automáticamente una pantalla**. La aplicación debe utilizar los componentes y salidas públicas de AUR y suministrar su propio contenido, estado y eventos. La selección de temas se realiza mediante `ThemeService`.

## Qué hace AUR y qué no hace

AUR proporciona componentes, composición visual, edición inmutable y validación local para los once tipos semánticos publicados. No proporciona servicios HTTP, autenticación, autorización, enrutamiento, persistencia ni reglas de negocio. El guardado con reconciliación de respuestas, la protección completa de navegación y el sistema definitivo de menús tipados están pendientes de completar.

Una validación local satisfactoria **no confirma** que el servidor haya aceptado los datos. Las comprobaciones diferidas siguen pendientes hasta que las resuelva la aplicación.

Para más detalles, consultar la documentación principal en inglés: [Getting started](../getting-started.md) y [Public API overview](../api-overview.md).

## Licencia

Apache-2.0. Consultar los archivos `LICENSE` y `NOTICE` de la distribución.
