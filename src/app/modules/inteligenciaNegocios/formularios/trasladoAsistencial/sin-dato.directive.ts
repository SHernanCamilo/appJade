import { AfterViewChecked, AfterViewInit, Directive, ElementRef, OnDestroy } from '@angular/core';

const TEXTO_SIN_DATO = 'Sin dato';
const TIPOS_IGNORADOS = new Set(['radio', 'checkbox', 'hidden', 'file', 'button', 'submit', 'reset']);
const TIPOS_CON_OVERLAY = new Set(['time', 'date', 'datetime-local']);

@Directive({
  selector: '[appSinDato]',
  standalone: true
})
export class SinDatoDirective implements AfterViewInit, AfterViewChecked, OnDestroy {
  private readonly overlays = new Map<HTMLInputElement, HTMLElement>();
  private observer?: MutationObserver;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.escanear();
    this.observer = new MutationObserver(() => this.escanear());
    this.observer.observe(this.host.nativeElement, { childList: true, subtree: true });
  }

  ngAfterViewChecked(): void {
    this.overlays.forEach((overlay, input) => {
      if (!input.isConnected) {
        overlay.remove();
        this.overlays.delete(input);
        return;
      }
      this.actualizarOverlay(input, overlay);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.overlays.forEach(overlay => overlay.remove());
    this.overlays.clear();
  }

  private escanear(): void {
    const campos = this.host.nativeElement.querySelectorAll('.formato-sheet input, .formato-sheet textarea');
    campos.forEach(node => this.aplicar(node as HTMLInputElement));
  }

  private aplicar(el: HTMLInputElement): void {
    const type = (el.type || 'text').toLowerCase();
    if (TIPOS_IGNORADOS.has(type)) {
      return;
    }

    if (TIPOS_CON_OVERLAY.has(type)) {
      this.asegurarOverlay(el);
      return;
    }

    if (el.getAttribute('placeholder') !== TEXTO_SIN_DATO) {
      el.setAttribute('placeholder', TEXTO_SIN_DATO);
    }
  }

  private asegurarOverlay(input: HTMLInputElement): void {
    if (this.overlays.has(input)) {
      return;
    }
    const parent = input.parentElement;
    if (!parent) {
      return;
    }
    parent.classList.add('sin-dato-parent');
    const overlay = document.createElement('span');
    overlay.className = 'sin-dato-overlay';
    overlay.textContent = TEXTO_SIN_DATO;
    overlay.setAttribute('aria-hidden', 'true');
    parent.appendChild(overlay);
    this.overlays.set(input, overlay);

    const sync = () => this.actualizarOverlay(input, overlay);
    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    input.addEventListener('focus', () => overlay.classList.add('is-hidden'));
    input.addEventListener('blur', sync);
    this.actualizarOverlay(input, overlay);
  }

  private actualizarOverlay(input: HTMLInputElement, overlay: HTMLElement): void {
    const vacio = !String(input.value ?? '').trim();
    const enfocado = document.activeElement === input;
    overlay.classList.toggle('is-hidden', !vacio || enfocado);
    overlay.style.left = `${input.offsetLeft + 4}px`;
    overlay.style.top = `${input.offsetTop}px`;
    overlay.style.height = `${input.offsetHeight}px`;
    overlay.style.lineHeight = `${input.offsetHeight}px`;
  }
}
