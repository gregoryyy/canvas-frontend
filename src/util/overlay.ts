import { createElement } from './dom';

interface ConfirmableElement extends HTMLElement {
  originalText?: string | null;
  confirming?: boolean;
  confirmTimeout?: ReturnType<typeof setTimeout>;
}

export function overlayMenu(
  elem: HTMLElement,
  title: string,
  list: (string | [string, string])[],
  cbLoad: (value: string) => void,
  cbDel?: (value: string) => void,
): void {
  const closeController = new AbortController();

  const closeMenu = (): void => {
    menu!.remove();
    elem.classList.remove('menuopen');
    closeController.abort();
  };

  const normalizeItem = (item: string | [string, string]): [string, string] =>
    typeof item === 'object' ? [item[0], item[1]] : [item, item];

  let menu = document.querySelector<HTMLDivElement>('.overlay-menu');
  if (!menu) {
    menu = createElement('div', { class: 'overlay-menu' }) as HTMLDivElement;
    menu.appendChild(createElement('h3', {}, title));
    elem.classList.add('menuopen');
  } else {
    closeMenu();
    return;
  }

  if (list.length == 0)
    menu.appendChild(createElement('div', { class: 'overlay-menu-item' }, '(empty)'));

  list.forEach((item) => {
    const item2 = normalizeItem(item);
    const menuItem = createElement('div', { class: 'overlay-menu-item' }, item2[0]);
    menuItem.addEventListener('click', () => {
      cbLoad(item2[1]);
      closeMenu();
    });
    if (cbDel) {
      const delBtn = createElement('span', { class: 'overlay-menu-item-delete' }, 'Delete');
      delBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        confirmStep(delBtn, () => {
          cbDel(item2[1]);
          delBtn.parentElement!.remove();
        });
      });
      menuItem.appendChild(delBtn);
    }
    menu!.appendChild(menuItem);
  });

  document.body.appendChild(menu);
  const rect = elem.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  // position above the trigger, clamped to viewport top
  const menuTop = window.scrollY + rect.top - menu.offsetHeight;
  menu.style.top = `${Math.max(window.scrollY, menuTop)}px`;
  menu.style.display = 'block';

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Node;
      if (menu && !elem.contains(target) && !menu.contains(target)) closeMenu();
    },
    { signal: closeController.signal },
  );
}

export function confirmStep(raw: HTMLElement, callback: () => void, timeout = 3000): void {
  const elem = raw as ConfirmableElement;

  const resetElem = (): void => {
    elem.textContent = elem.originalText ?? null;
    elem.style.color = '';
    elem.confirming = false;
  };

  if (!elem.confirming) {
    elem.originalText = elem.textContent;
    elem.textContent = elem.textContent! + '?';
    elem.style.color = 'red';
    elem.confirming = true;
    elem.confirmTimeout = setTimeout(resetElem, timeout);
  } else {
    clearTimeout(elem.confirmTimeout);
    callback();
    resetElem();
    elem.textContent = elem.originalText ?? null;
    elem.style.color = '';
    elem.confirming = false;
  }
}

export function showToast(message: string, isError = false, duration = 2500): void {
  const toast = createElement('div', { class: 'toast' + (isError ? ' toast-error' : '') }, message);
  document.body.appendChild(toast);
  // force reflow so the .toast-visible transition starts from the base state
  void toast.offsetHeight;
  toast.classList.add('toast-visible');
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, duration);
}
