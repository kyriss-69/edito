import { describe, expect, it } from "vitest";

import {
  buildChatSystemPrompt,
  chatTitle,
  chatTools,
  historyMessages,
  parseChatEntries,
  parseToolCall,
  type ChatEntry,
} from "../ai/chat";
import { DEFAULT_AI_SETTINGS } from "../ai/settings";
import { pickSitePages } from "../ai/site";
import { buildSystemPrompt, buildTaskMessages, parseTaskOutput } from "../ai/tasks";
import { cleanPageText, displayUrl, formatSearchResults, normalizeUrl, parseBingResults } from "../web";

const brand = DEFAULT_AI_SETTINGS.brand;

describe("adresses web", () => {
  it("complète et vérifie les adresses", () => {
    expect(normalizeUrl("lumen.fr/tarifs")).toBe("https://lumen.fr/tarifs");
    expect(normalizeUrl(" https://lumen.fr#haut ")).toBe("https://lumen.fr/");
    expect(normalizeUrl("http://localhost:3000")).toBe("http://localhost:3000/");
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://lumen.fr")).toBeNull();
    expect(normalizeUrl("pas une adresse")).toBeNull();
    expect(normalizeUrl("lumen")).toBeNull();
  });

  it("affiche l'adresse comme dans une barre d'adresse", () => {
    expect(displayUrl("https://www.lumen.fr/")).toBe("lumen.fr");
    expect(displayUrl("https://lumen.fr/camille.laurent/")).toBe("lumen.fr/camille.laurent");
  });

  it("nettoie le texte des pages et le coupe", () => {
    expect(cleanPageText("  Titre  \n\n\n\n  Texte ici ", 100)).toEqual({ text: "Titre\n\nTexte ici", truncated: false });
    const long = cleanPageText(`${"a".repeat(90)}\n${"b".repeat(50)}`, 100);
    expect(long.truncated).toBe(true);
    expect(long.text).toBe(`${"a".repeat(90)}\n[…]`);
  });
});

describe("recherche web", () => {
  const html = [
    '<ol><li class="b_algo" data-id><h2><a target="_blank" href="https://www.bing.com/ck/a?!&amp;&amp;p=x&amp;u=a1aHR0cHM6Ly9mci53aWtpcGVkaWEub3JnL3dpa2kvTSVDMyVBOWRpYQ&amp;ntb=1">M&#233;dia — <strong>Wikip&#233;dia</strong></a></h2>',
    '<div class="b_caption"><p class="b_lineclamp2">En latin, media est le pluriel de medium.</p></div></li>',
    '<li class="b_algo"><h2><a href="https://exemple.fr/guide">Guide du <b>media kit</b></a></h2><p>Comment créer son media kit.</p></li>',
    '<li class="b_algo"><h2><a href="https://www.bing.com/images/search?q=x">Images</a></h2></li></ol>',
  ].join("");

  it("lit les résultats de Bing (liens de redirection décodés)", () => {
    expect(parseBingResults(html)).toEqual([
      {
        title: "Média — Wikipédia",
        url: "https://fr.wikipedia.org/wiki/M%C3%A9dia",
        snippet: "En latin, media est le pluriel de medium.",
      },
      { title: "Guide du media kit", url: "https://exemple.fr/guide", snippet: "Comment créer son media kit." },
    ]);
    expect(parseBingResults(html, 1)).toHaveLength(1);
    expect(parseBingResults("<html>captcha</html>")).toEqual([]);
  });

  it("présente les résultats au modèle", () => {
    expect(formatSearchResults("media kit", [])).toBe("Aucun résultat pour « media kit ».");
    expect(formatSearchResults("media kit", parseBingResults(html))).toContain("2. Guide du media kit\n   https://exemple.fr/guide");
  });
});

describe("discussion avec l'assistant", () => {
  it("lit les appels d'outils du modèle", () => {
    expect(parseToolCall("web_search", '{"query":"tendances UGC 2026"}')).toEqual({
      ok: true,
      name: "web_search",
      input: { query: "tendances UGC 2026" },
    });
    const shot = parseToolCall("take_screenshot", '{"url":"lumen.fr","device":"tablette"}');
    expect(shot.ok && shot.name === "take_screenshot" && shot.input).toMatchObject({ device: "desktop", mode: "page" });
    const ideas = parseToolCall("propose_post_ideas", '{"ideas":[{"title":"Les tarifs","format":"reel"}]}');
    expect(ideas.ok && ideas.name === "propose_post_ideas" && ideas.input.ideas[0]).toEqual({
      title: "Les tarifs",
      hook: "",
      format: "image",
      angle: "",
    });
    expect(parseToolCall("delete_everything", "{}")).toMatchObject({ ok: false });
    expect(parseToolCall("read_page", "{url:")).toMatchObject({ ok: false });
    expect(parseToolCall("read_page", "{}")).toMatchObject({ ok: false });
  });

  it("ne propose les outils web que si l'accès à internet est activé", () => {
    expect(chatTools({ web: true }).map((t) => t.function.name)).toEqual([
      "web_search",
      "read_page",
      "take_screenshot",
      "propose_post_ideas",
    ]);
    expect(chatTools({ web: false }).map((t) => t.function.name)).toEqual(["propose_post_ideas"]);
  });

  it("renvoie l'historique au modèle avec les outils utilisés", () => {
    const entries: ChatEntry[] = [
      { id: "1", role: "user", content: "Capture le site", createdAt: 1 },
      {
        id: "2",
        role: "assistant",
        content: "Voilà !",
        createdAt: 2,
        steps: [
          {
            id: "s",
            tool: "take_screenshot",
            status: "done",
            label: "Capture",
            capture: { assetId: 3, title: "Accueil", url: "https://lumen.fr/", device: "mobile" },
          },
          { id: "t", tool: "web_search", status: "error", label: "Recherche : x" },
        ],
      },
    ];
    const messages = historyMessages(entries);
    expect(messages[0]).toEqual({ role: "user", content: "Capture le site" });
    expect(messages[1].content).toContain("capture d'écran « Accueil » enregistrée dans la médiathèque (lumen.fr)");
    expect(messages[1].content).not.toContain("Recherche : x");
    expect(parseChatEntries([entries[0], { role: "?" }, null])).toEqual([entries[0]]);
  });

  it("titre une discussion d'après le premier message", () => {
    expect(chatTitle("  Idées pour la rentrée\nAvec des carrousels")).toBe("Idées pour la rentrée");
    expect(chatTitle("a".repeat(80))).toHaveLength(58);
    expect(chatTitle("")).toBe("Nouvelle discussion");
  });

  it("explique son rôle, ses outils et les posts déjà prévus", () => {
    const prompt = buildChatSystemPrompt({
      brand,
      web: true,
      siteUrl: "https://lumen.fr/",
      today: new Date(2026, 9, 12),
      pillars: ["Éducatif"],
      posts: [{ title: "Les 5 erreurs du media kit", status: "Idées", date: null, format: "carousel" }],
    });
    expect(prompt).toContain("lundi 12 octobre 2026");
    expect(prompt).toContain("Site de la marque : https://lumen.fr/");
    expect(prompt).toContain("- Les 5 erreurs du media kit (Carrousel, Idées)");
    expect(prompt).not.toContain("Format de réponse");
    const offline = buildChatSystemPrompt({ brand, web: false, siteUrl: "", today: new Date(), pillars: [], posts: [] });
    expect(offline).toContain("pas accès à internet");
    expect(offline).not.toContain("web_search");
  });
});

describe("analyse du site", () => {
  it("choisit les pages principales du site", () => {
    const links = [
      { url: "https://lumen.fr/", label: "Accueil" },
      { url: "https://lumen.fr/guides#top", label: "Guides" },
      { url: "https://lumen.fr/guides", label: "Guides" },
      { url: "https://lumen.fr/mentions-legales", label: "Mentions" },
      { url: "https://lumen.fr/createurs?ref=menu", label: "Créateurs" },
      { url: "https://lumen.fr/media-kit.pdf", label: "PDF" },
    ];
    expect(pickSitePages(links, "https://lumen.fr/")).toEqual(["https://lumen.fr/guides", "https://lumen.fr/createurs"]);
    expect(pickSitePages(links, "https://lumen.fr/", 1)).toEqual(["https://lumen.fr/guides"]);
  });

  it("ajoute le résumé du site aux consignes de toutes les tâches", () => {
    const prompt = buildSystemPrompt(
      { ...brand, site: { url: "https://lumen.fr/", summary: "MESSAGES CLÉS\n- Zéro commission", analyzedAt: Date.UTC(2026, 9, 1) } },
      '{"caption": "…"}',
    );
    expect(prompt).toContain("# Ce que dit le site https://lumen.fr/ (analysé le 01/10/2026)");
    expect(prompt).toContain("- Zéro commission");
    expect(buildSystemPrompt(brand, null)).not.toContain("Format de réponse");
  });

  it("résume le site sans document de référence ni ancien résumé", () => {
    const built = buildTaskMessages(
      "siteSummary",
      { url: "https://lumen.fr/", pages: [{ url: "https://lumen.fr/", title: "Lumen", text: "Zéro commission, jamais" }] },
      { ...brand, doc: "DOCUMENT SECRET", site: { url: "x", summary: "ANCIEN RÉSUMÉ", analyzedAt: null } },
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(String(built.messages[0].content)).not.toContain("DOCUMENT SECRET");
    expect(String(built.messages[0].content)).not.toContain("ANCIEN RÉSUMÉ");
    expect(String(built.messages[1].content)).toContain("Zéro commission, jamais");
    expect(parseTaskOutput("siteSummary", '{"summary": "MESSAGES CLÉS\\n- …"}')).toEqual({ summary: "MESSAGES CLÉS\n- …" });
  });
});

describe("carrousel avec captures", () => {
  it("indique à l'IA les slides qui portent une capture et leur place réduite", () => {
    const built = buildTaskMessages(
      "carouselSlides",
      {
        title: "Media kit",
        description: "Montrer le media kit en ligne",
        slides: [
          { title: "", body: "" },
          { title: "", body: "", visual: "capture d'écran de lumen.fr dans un téléphone", capacity: { title: 40, body: 80 } },
        ],
      },
      brand,
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const user = String(built.messages[1].content);
    expect(user).toContain("- Slide 1 (couverture : l'accroche) : vide");
    expect(user).toContain(
      "avec capture d'écran de lumen.fr dans un téléphone sous le texte : le texte doit l'introduire ; place réduite : titre de 40 caractères maximum, texte de 80 caractères maximum",
    );
  });
});
