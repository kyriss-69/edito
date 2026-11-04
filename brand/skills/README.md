# Skills par réseau (sources externes)

Copies, sans modification, de skills publiés sur GitHub (fichiers Markdown seulement, scripts non repris).
Ils serviront de consignes à l'assistant (phase 3 de `docs/agent-redaction.md`). Récupérés le 2026-10-18.

| Dossier | Source | Commit | Licence |
|---|---|---|---|
| `commun/SKILL.md`, `commun/references/`, `tiktok/short-form-video.md`, `x/x-algorithm.md` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) `skills/social` | 365b412 | MIT (`commun/LICENSE`) |
| `commun/platform-norm-profiler/`, `tiktok/short-video-scripter/` | [aaron-he-zhu/aaron-marketing-skills](https://github.com/aaron-he-zhu/aaron-marketing-skills) | c7fc63a | Apache-2.0 (`LICENSE-apache`) |
| `instagram/` (ig-caption, ig-carousel, ig-reel, ig-human) | [Jakeschincariol/instagram-agent-skill](https://github.com/Jakeschincariol/instagram-agent-skill) | d03c56b | MIT |
| `linkedin/` (post-writer, hook-extractor, humanizer, repurposer) | [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) | 261240a | MIT |
| `x/x-longform-post/`, `youtube/` | [ericosiu/ai-marketing-skills](https://github.com/ericosiu/ai-marketing-skills) | 8088e1a | MIT |

Facebook : section « Facebook » de `commun/references/platforms.md`.

À noter : les skills `youtube/` d'ericosiu sont écrits pour lancer des scripts Python (télémétrie, clé API) ;
seuls leurs conseils de rédaction (titres, miniatures, grille `packaging-rubric.md`) sont utilisables ici.

Mettre à jour depuis GitHub : `npm run skills:update` (fichiers listés dans `sources.json`), puis relire `git diff brand/skills` avant de committer.
