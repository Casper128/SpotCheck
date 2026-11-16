import { parse, serialize } from 'parse5';

export function proxyUrl(value, base, origin) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#') || /^(data:|blob:|mailto:|tel:)/i.test(trimmed)) return value;
  try {
    const target = new URL(trimmed, base);
    if (!['http:', 'https:'].includes(target.protocol)) return '#';
    const hash = target.hash;
    target.hash = '';
    return `${origin}/?url=${encodeURIComponent(target.href)}${hash}`;
  } catch { return '#'; }
}

export function rewriteCSS(css, base, origin) {
  return css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi,
    (_, double, single, bare) => `url("${proxyUrl(double ?? single ?? bare, base, origin).replaceAll('"', '%22')}")`)
    .replace(/(@import\s+)(["'])([^"']+)\2/gi,
      (_, prefix, quote, url) => `${prefix}${quote}${proxyUrl(url, base, origin)}${quote}`);
}

export function rewriteHTML(html, target, origin, appOrigin) {
  const document = parse(html);
  let base = target;
  // Honor the first upstream base before removing it.
  const findBase = (node) => {
    if (node.tagName === 'base') {
      const href = node.attrs.find((attribute) => attribute.name === 'href')?.value;
      if (href) { try { base = new URL(href, target).href; return true; } catch { /* ignore invalid base */ } }
    }
    return (node.childNodes || []).some(findBase);
  };
  findBase(document);
  const visit = (node) => {
    if (node.childNodes) {
      node.childNodes = node.childNodes.filter((child) => child.tagName !== 'base'
        && !(child.tagName === 'meta' && child.attrs.some((attribute) => attribute.name === 'http-equiv')));
      for (const child of node.childNodes) visit(child);
    }
    if (node.content) visit(node.content);
    if (!node.attrs) return;
    node.attrs = node.attrs.filter((attribute) => !['integrity', 'nonce', 'crossorigin', 'ping', 'srcdoc'].includes(attribute.name));
    for (const attribute of node.attrs) {
      if (['href', 'src', 'poster', 'action', 'formaction', 'data'].includes(attribute.name))
        attribute.value = proxyUrl(attribute.value, base, origin);
      if (attribute.name === 'style') attribute.value = rewriteCSS(attribute.value, base, origin);
      if (attribute.name === 'srcset') {
        // Browser falls back to rewritten src; removing avoids bypass through complex data URL candidates.
        attribute.value = '';
      }
      if (attribute.name === 'target') attribute.value = '_self';
    }
    if (node.tagName === 'style') {
      for (const child of node.childNodes || []) if (child.nodeName === '#text') child.value = rewriteCSS(child.value, base, origin);
    }
  };
  visit(document);
  const output = serialize(document);
  const injection = `<script>${runtimeScript(target, origin)}</script><script src="${origin}/spotcheck-inspector.js" data-parent-origin="${appOrigin}" data-allowed-hosts="${new URL(origin).hostname}" defer></script>`;
  // Run before the site's scripts, including synchronous ones.
  return output.replace(/<head>/i, `<head>${injection}`);
}

function runtimeScript(target, origin) {
  const config = JSON.stringify({ target, origin }).replaceAll('<', '\\u003c');
  return `(() => {
    const config = ${config};
    const originalUrl = () => { try { return new URL(location.href).searchParams.get('url') || config.target; } catch { return config.target; } };
    const wrap = (value) => {
      const url = new URL(String(value), originalUrl());
      if (!['http:', 'https:'].includes(url.protocol)) return url.href;
      if (url.origin === config.origin && (url.pathname === '/spotcheck-inspector.js' || url.searchParams.has('url'))) return url.href;
      const hash = url.hash;
      url.hash = '';
      return config.origin + '/?url=' + encodeURIComponent(url.href) + hash;
    };
    const fetchOriginal = window.fetch;
    window.fetch = function(input, init) {
      if (input instanceof Request) return fetchOriginal.call(this, new Request(wrap(input.url), input), init);
      return fetchOriginal.call(this, wrap(input), init);
    };
    const openOriginal = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) { return openOriginal.call(this, method, wrap(url), ...rest); };
    for (const method of ['pushState', 'replaceState']) {
      const original = history[method];
      history[method] = function(state, unused, url) { return original.call(this, state, unused, url == null ? url : wrap(url)); };
    }
    document.addEventListener('click', (event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (anchor) { anchor.href = wrap(anchor.getAttribute('href')); anchor.target = '_self'; }
    }, true);
    document.addEventListener('submit', (event) => { event.preventDefault(); }, true);
  })();`;
}
