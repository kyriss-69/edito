/** État du kanban : id de colonne → ids des posts, dans l'ordre d'affichage. */
export type BoardState = Record<string, string[]>;

export function findContainer(state: BoardState, id: string): string | undefined {
  if (id in state) return id;
  return Object.keys(state).find((key) => state[key].includes(id));
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Déplace `activeId` à l'emplacement de `overId` (un post ou une colonne).
 * Travaille sur les listes complètes : les posts masqués par un filtre gardent
 * leur place relative.
 */
export function moveItem(
  state: BoardState,
  activeId: string,
  overId: string,
  placeAfter = false,
): BoardState {
  const from = findContainer(state, activeId);
  const to = findContainer(state, overId);
  if (!from || !to || activeId === overId) return state;

  if (from === to) {
    if (overId === to) return state;
    const items = state[from];
    return {
      ...state,
      [from]: arrayMove(items, items.indexOf(activeId), items.indexOf(overId)),
    };
  }

  const toItems = [...state[to]];
  let index = overId === to ? toItems.length : toItems.indexOf(overId);
  if (placeAfter && overId !== to) index += 1;
  toItems.splice(index, 0, activeId);

  return {
    ...state,
    [from]: state[from].filter((id) => id !== activeId),
    [to]: toItems,
  };
}
