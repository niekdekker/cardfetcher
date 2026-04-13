# Cardfetcher

Paste a **Magic: The Gathering** decklist, pick printings, and download **high-resolution card art**.

**Live site:** [cardfetcher.app](https://cardfetcher.app)

---

- Parses common decklist formats (including **Moxfield-style** lines with tags and set codes).
- Fetches card data from the **[Scryfall](https://scryfall.com)** API.
- Shows a preview grid; open a card to **change printing** or **flip** double-faced cards.
- **Download all** bundles images into a `**.zip`** (via [JSZip](https://stuk.github.io/jszip/)).
- Optional button that switches all card art to **old frames** for those who enjoy that sort of thing (me).
- **Figma / FigJam:** paste a list and **import** rectangles filled with the same hi-res art (see `[figma-plugin/](figma-plugin/)`).

Card art and data are provided by Scryfall. Cardfetcher is **unofficial fan content** and is **not affiliated with Wizards of the Coast**. [Buy them a coffee!](https://scryfall.com/donate)

---

- Static **HTML / CSS / JavaScript**.
- Scryfall HTTP API from the browser.
- Fonts: **Inter** + **Lora** (Google Fonts).
- Made with cursor.

---

Issues and pull requests are welcome. Keep changes focused and consistent with the existing plain-JS style unless the project moves to a bundler.

A tiny tool by Niek Dekker — [niekdekker.com](https://niekdekker.com)