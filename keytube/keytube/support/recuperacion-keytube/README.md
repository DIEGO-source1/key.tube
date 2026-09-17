# Recuperación de KeyTube en Windows

Para la instalación que quedó en 637 de 640 paquetes, con Node.js 22.19.0 y pnpm 11.25.0.

1. Cancela cualquier instalación pendiente con Ctrl+C.
2. Extrae este ZIP. Copia la carpeta `recuperacion-keytube` dentro de la carpeta del proyecto `keytube`.
3. En PowerShell, situado en `keytube`, ejecuta:

```powershell
node .\recuperacion-keytube\recuperar.mjs
if ($LASTEXITCODE -eq 0) {
    pnpm.cmd db:setup
    if ($LASTEXITCODE -eq 0) {
        pnpm.cmd dev
    }
}
```

Mantén abierta la consola del servidor y abre la dirección que indique `dev`.
El puerto habitual de este proyecto es http://localhost:5173.

## Qué contiene

Copias sin modificar de los archivos originales de npm:

| Paquete | Versión | Tamaño del archivo |
| --- | --- | ---: |
| next | 16.3.4 | 41.736.673 bytes |
| @next/swc-win32-x64-msvc | 16.3.4 | 34.863.638 bytes |
| @cloudflare/workerd-windows-64 | 1.20260515.1 | 31.881.986 bytes |

Los archivos conservan los avisos de licencia de sus paquetes. Las URL de origen son las del registro oficial `registry.npmjs.org`, y las tres huellas SHA-512 están fijadas en el recuperador y coinciden con el lockfile original.

## Cómo funciona

El script comprueba primero las huellas, el proyecto y la versión exacta de pnpm.
Usa `pnpm store add` para importar los archivos locales. Este comando guarda
paquetes en la caché sin añadir dependencias a `package.json`:
https://pnpm.io/cli/store

En pnpm 11.25.0 los archivos locales quedan indexados como `file:...`.
El recuperador copia exclusivamente sus tres registros verificados a las claves
de nombre y versión del lockfile, dentro del índice SQLite v11 de la caché.
Guarda los valores anteriores de esas tres claves en un archivo
`cache-backup-*.json`, y usa una transacción. No reemplaza el índice completo,
no elimina los otros paquetes y no toca la base de datos de KeyTube.

Después ejecuta la instalación con `--frozen-lockfile --offline`. No modifica
las versiones, el registro global, TLS, las restricciones sobre scripts ni las
políticas de antigüedad y confianza del proyecto.

## Si aparece otro error

Este paquete repone los tres archivos que faltaban en el registro de errores
compartido. No contiene las 640 dependencias completas. Si faltan otros archivos
o los metadatos que pnpm necesita para comprobar sus políticas, la instalación
se detendrá y mostrará su nombre. El modo offline no elimina esas comprobaciones.
No se ejecutarán la base de datos ni el servidor si la instalación falla.

Comparte las últimas líneas del error. No borres la caché ni `pnpm-lock.yaml`.

Para incorporar solamente los tres archivos sin ejecutar la instalación:

```powershell
node .\recuperacion-keytube\recuperar.mjs --solo-cache
```

El recuperador está limitado expresamente a pnpm 11.25.0 y el formato v11.
La importación y reutilización de los paquetes se comprueban en Linux con esa
versión; no se dispone de una sesión de Windows para ejecutar el flujo completo.
La aplicación todavía necesita sus dependencias restantes, la inicialización
local de la base de datos y el servidor en ejecución.
