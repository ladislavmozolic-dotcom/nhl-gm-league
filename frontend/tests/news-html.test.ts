import assert from "node:assert/strict";
import { test } from "node:test";
import { articlePlainText, sanitizeArticleHtml } from "../lib/news-html";

test("keeps editor formatting and the perex marker", () => {
  const input = '<h2>Headline</h2><p><b>Bold</b> <i>italic</i></p><ul><li>One</li></ul><hr class="article-cut"><font size="5">Large</font>';
  assert.equal(sanitizeArticleHtml(input), input.replace("<hr class=\"article-cut\">", "<hr class=\"article-cut\" />"));
});

test("removes scripts, handlers, embeds, styles and unsafe URLs", () => {
  const input = '<script>alert(1)</script><p onclick="alert(2)" style="position:fixed">Hello</p><iframe src="https://evil.test"></iframe><a href="javascript:alert(3)">link</a><img src="javascript:alert(4)" onerror="alert(5)">';
  const output = sanitizeArticleHtml(input);
  for (const unsafe of ["script", "onclick", "style=", "iframe", "javascript:", "onerror"]) assert.equal(output.includes(unsafe), false);
  assert.match(output, /Hello/);
});

test("allows ordinary links and hardens new-window links", () => {
  assert.equal(sanitizeArticleHtml('<a href="https://example.test/a" target="_blank">go</a>'), '<a href="https://example.test/a" target="_blank" rel="noopener noreferrer">go</a>');
  assert.equal(sanitizeArticleHtml('<a href="/teams">teams</a>'), '<a href="/teams">teams</a>');
  assert.equal(sanitizeArticleHtml('<a href="//evil.test">bad</a>'), '<a>bad</a>');
});

test("allows raster data images and removes active data payloads", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(sanitizeArticleHtml(`<img src="${png}" alt="photo" />`), `<img src="${png}" alt="photo" />`);
  assert.equal(sanitizeArticleHtml('<img src="data:image/svg+xml;base64,PHN2Zz4=" />'), "");
  assert.equal(sanitizeArticleHtml('<img src="DATA:image/svg+xml;base64,PHN2Zz4=" />'), "");
  assert.equal(sanitizeArticleHtml('<img src="data:text/html;base64,PHNjcmlwdD4=" />'), "");
});

test("only the editor class is allowed on a perex line", () => {
  assert.equal(sanitizeArticleHtml('<hr class="article-cut evil" id="x">'), '<hr class="article-cut" />');
});

test("plain-text previews are derived from sanitized content", () => {
  assert.equal(articlePlainText('<p>Hello &amp; <b>safe</b></p><script>bad()</script>'), "Hello & safe");
});
