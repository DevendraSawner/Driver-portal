/** MongoDB: missing optional fields do not match `field: null`. Match both. */
export function notDeletedFilter(): { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] } {
  return {
    OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
  };
}
