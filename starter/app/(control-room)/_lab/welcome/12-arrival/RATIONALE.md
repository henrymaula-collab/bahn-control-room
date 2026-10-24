# welcome 12: The greeting arrives first

- References: Flora, "Hey, Bertrand." alone and centred while the product loads; the loading state is the greeting (https://nicelydone.club/examples/screens/16cf83a0-b7e4-45d3-95fc-47e6fd32e9d6, `research/premium/visual/shots/welcome-08-flora-personal-welcome.png`); Daybridge, the welcome as a card floating over the live product (https://nicelydone.club/examples/screens/e24f9549-25d7-409b-a97b-20b7faccd78d, `research/premium/visual/shots/welcome-17-daybridge-welcome-modal.png`).
- Borrowed: the greeting first and alone, then the product. Here "Welcome back to Bahn Express, Aino." rises in the middle of a birch veil, holds for about a second, then glides and shrinks into its place in the panel while the veil lifts off the map; the pill and rows follow 70 ms apart and the key's counts run up from zero.
- Motion numbers: one ease-out (M3 Standard), 1.9 s for the greeting, 420 ms per row, 650 ms veil; nothing bounces (`research/premium/product/rules.md` 1). Reduced motion: the panel simply appears.
- Why for ops: it is the video's first shot. The tiles load under the veil, so the first thing anyone sees is a finished screen with her name on it, never a half-drawn map.
- Trade-off: two seconds before the panel can be used on every load; in v4 it should play once per session.
