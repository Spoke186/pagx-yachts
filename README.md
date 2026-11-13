# PAGX Yachts

Concepto de alquiler de yates. Loop de drone dibujado a través de un shader de agua, una película que se abre como obturador con bitácora clicable y carta náutica de Mallorca.

**En vivo:** https://pagx-yachts.vercel.app

> Concepto propio de PagX Studio: la marca, los productos y las cifras son ficticios.

## Stack

Astro 7 · GSAP + ScrollTrigger · Lenis · WebGL (shader de estela)

Sitio 100 % estático, con tres niveles de animación (alto, medio y estático) y soporte para `prefers-reduced-motion`.

## Correr en local

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # salida estática en dist/
```

Requiere Node 22.12 o superior. `packages/motion` es el reloj de scroll compartido de PagX: GSAP y Lenis se mueven con un solo ticker.

## Licencia

© 2026 Esteban Muñoz · [PagX Studio](https://pagxstudio.com). Todos los derechos reservados. Ver [LICENSE](LICENSE).
