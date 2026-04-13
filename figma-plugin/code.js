// Runs in Figma's sandbox. No fetch/DOM. Talks to ui.html via postMessage.

figma.showUI(__html__, { width: 420, height: 560, themeColors: true });

const CARD_W = 488;
const CARD_H = 680;
const GAP = 24;
const COLS = 5;

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'import-cards') {
    const { cards } = msg; // [{ name, bytes, isDfc, backBytes? }]
    if (!cards || !cards.length) {
      figma.ui.postMessage({ type: 'error', message: 'No cards to import' });
      return;
    }

    try {
      // Create a frame to hold everything so it's tidy
      const frame = figma.createFrame();
      frame.name = `Cardfetcher — ${cards.length} card${cards.length === 1 ? '' : 's'}`;
      frame.fills = [];
      frame.clipsContent = false;
      frame.layoutMode = 'NONE';

      // Drop it at viewport center
      const center = figma.viewport.center;
      frame.x = center.x - 1000;
      frame.y = center.y - 800;

      const nodes = [];
      let col = 0;
      let row = 0;

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        figma.ui.postMessage({ type: 'progress', done: i, total: cards.length, name: card.name });

        // Front face
        const frontImage = figma.createImage(new Uint8Array(card.bytes));
        const front = figma.createRectangle();
        front.name = card.name;
        front.resize(CARD_W, CARD_H);
        front.cornerRadius = 24;
        front.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: frontImage.hash }];
        front.x = col * (CARD_W + GAP);
        front.y = row * (CARD_H + GAP);
        frame.appendChild(front);
        nodes.push(front);

        col++;
        if (col >= COLS) { col = 0; row++; }

        // Back face for double-faced cards
        if (card.isDfc && card.backBytes) {
          const backImage = figma.createImage(new Uint8Array(card.backBytes));
          const back = figma.createRectangle();
          back.name = card.name + ' (back)';
          back.resize(CARD_W, CARD_H);
          back.cornerRadius = 24;
          back.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: backImage.hash }];
          back.x = col * (CARD_W + GAP);
          back.y = row * (CARD_H + GAP);
          frame.appendChild(back);
          nodes.push(back);

          col++;
          if (col >= COLS) { col = 0; row++; }
        }
      }

      // Size the frame to fit content
      const totalRows = row + (col > 0 ? 1 : 0);
      frame.resize(
        COLS * CARD_W + (COLS - 1) * GAP,
        totalRows * CARD_H + Math.max(0, totalRows - 1) * GAP
      );

      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);

      figma.ui.postMessage({ type: 'done', count: nodes.length });
    } catch (err) {
      figma.ui.postMessage({ type: 'error', message: String(err && err.message || err) });
    }
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }

  if (msg.type === 'notify') {
    figma.notify(msg.message);
  }
};
