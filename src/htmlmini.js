// Minimalny, zależny-od-niczego parser HTML (bez npm) - specjalnie pod
// potrzeby scrapowania: znajdywanie linków <a href>, chodzenie po rodzicach,
// wyciąganie tekstu z fragmentu drzewa. Nie jest to pełny parser HTML (nie
// musi być) - wystarczająco tolerancyjny na "brudny" HTML prawdziwych stron.
//
// Węzeł: { type: "element"|"text", tag, attrs, children, parent, value }

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(str) {
  if (!str) return "";
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, ent) => {
    if (ent[0] === "#") {
      const isHex = ent[1] === "x" || ent[1] === "X";
      const code = parseInt(ent.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ent] !== undefined ? ENTITIES[ent] : whole;
  });
}

function parseAttrs(str) {
  const attrs = {};
  if (!str) return attrs;
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|[^\s"'=<>`]+))?/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    const name = m[1].toLowerCase();
    let value = "";
    if (m[3] !== undefined) value = m[3];
    else if (m[4] !== undefined) value = m[4];
    else if (m[2] !== undefined) value = m[2];
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

export function parseHtml(html) {
  html = String(html || "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?<\/style>/gi, "");

  const root = { type: "element", tag: "#root", attrs: {}, children: [], parent: null };
  const stack = [root];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)((?:\s+[^<>]*?)?)\s*\/?>|([^<]+)/g;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[3] !== undefined) {
      const text = decodeEntities(m[3]);
      if (text.trim()) {
        const top = stack[stack.length - 1];
        top.children.push({ type: "text", value: text, parent: top });
      }
      continue;
    }
    const raw = m[0];
    const isClosing = raw[1] === "/";
    const tag = m[1].toLowerCase();

    if (isClosing) {
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const attrs = parseAttrs(m[2] || "");
    const selfClosing = raw.endsWith("/>") || VOID_ELEMENTS.has(tag);
    const node = { type: "element", tag, attrs, children: [], parent: stack[stack.length - 1] };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
  }
  return root;
}

export function getText(node) {
  const parts = [];
  (function walk(n) {
    if (n.type === "text") {
      const t = n.value.trim();
      if (t) parts.push(t);
    } else if (n.children) {
      for (const c of n.children) walk(c);
    }
  })(node);
  return parts.join(" ");
}

export function findAllAnchors(root) {
  const result = [];
  (function walk(n) {
    if (n.type === "element") {
      if (n.tag === "a" && n.attrs.href) result.push(n);
      for (const c of n.children || []) walk(c);
    }
  })(root);
  return result;
}

export function findFirstImg(node) {
  let found = null;
  (function walk(n) {
    if (found) return;
    if (n.type === "element") {
      if (n.tag === "img") {
        found = n;
        return;
      }
      for (const c of n.children || []) {
        if (found) return;
        walk(c);
      }
    }
  })(node);
  return found;
}

// Ile linkow-ofert (pasujacych do wzorca URL) jest w poddrzewie tego wezla -
// uzywane, zeby wiedziec kiedy podczas chodzenia w gore drzewa wyszlismy
// poza jedna karte oferty (patrz scraping.js).
export function countMatchingLinks(node, pattern) {
  let count = 0;
  (function walk(n) {
    if (count > 1) return;
    if (n.type === "element") {
      if (n.tag === "a" && n.attrs.href && pattern.test(n.attrs.href)) count++;
      for (const c of n.children || []) {
        if (count > 1) return;
        walk(c);
      }
    }
  })(node);
  return count;
}
