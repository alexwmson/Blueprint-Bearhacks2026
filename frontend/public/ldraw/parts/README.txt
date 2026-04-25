Place your LDraw official parts library .dat files here.

Download from: https://www.ldraw.org/parts/latest-parts.html

After extracting the archive, copy the contents of the "parts" folder here
so that files like 3001.dat (2x4 brick), 3004.dat (1x2 brick), etc. are
directly accessible at /ldraw/parts/3001.dat from the browser.

The path is configured in: frontend/src/lib/partsMap.js → PARTS_LIBRARY_PATH

Until the library is populated, the 3D viewer will render colored boxes
as a fallback so the app remains fully functional.
