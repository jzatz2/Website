# Joshua Zatz — Personal Portfolio

Static HTML, CSS and JavaScript. Open `index.html`, or run the local server:

```sh
node tools/preview.mjs
```

Then visit `http://127.0.0.1:4174/#projects`. A focused project-only preview is
also available at `http://127.0.0.1:4174/preview/projects.html`.

## Project cards

The five cards expand into their full row to show the original explanations,
photos and videos while the neighboring card slides away. On mobile, projects
expand within the single-column layout. Enter/Space toggles a focused card;
Escape closes it. Closing a project pauses its videos. Cover motion runs on
hover or keyboard focus on desktop and automatically on phones and touchscreens.
The covers pause offscreen or in a background tab and respect reduced-motion
preferences.

- `projects.css` — card layout, responsive breakpoints and illustration colours.
- `projects.js` — expansion, focus management and cover animation.
- `tools/build-project-covers.mjs` — all five illustrations and card copy.
- `assets/covers/` — exported SVGs and Anatomy surface styles.
- `preview/projects.html` — generated standalone preview of the projects section.

To change illustration geometry, edit the corresponding `fermi`, `abbott`,
`alloy`, `engine` or `robot` function, then regenerate:

```sh
node tools/build-project-covers.mjs
```

The build uses the vendored Anatomy toolkit and needs no package installation
or network access. It embeds the finished SVGs in `index.html`, so the covers
also render before JavaScript runs. Edit the descriptions and galleries directly
in `index.html`; regeneration preserves them. The generated cover markers should
remain in place.

The models are illustrative: NuMI's distances are compressed and its downstream
robot is enlarged as requested; the electrolyte cycle is not a calibrated CFD
result; the FCC unit cell illustrates crystal structure, not a particular alloy.
The engine and robot use the supplied SolidWorks/prototype images as references.
The figures are intended for portfolio presentation, not mechanical fit checks.

## Attribution

The covers use the projection, solid, lathe and depth-ordering tools from
[wheresryan22/anatomy](https://github.com/wheresryan22/anatomy), © 2026 Ryan,
MIT licensed. Reference revision: `e6600ffc4e8e6620eeb45bf49bcdbd5e4b84163f`.
The original license is retained in `tools/anatomy/LICENSE`.
