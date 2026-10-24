export function operatorCount(query: string): number {
  return (query.replace(/"[^"\n]*"/g, '').match(/\b(?:AND|OR|NOT)\b/gi) || []).length;
}
export function validateSearchQuery(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 3 || value.length > 240) throw new Error('Use a search query of 3–240 characters.');
  if (operatorCount(value) > 5) throw new Error('LinkedIn supports at most five AND, OR or NOT operators. Simplify your search.');
  return value.trim();
}
export function compactGeneratedQuery(value: unknown): string {
  if (typeof value !== 'string') throw new Error('The brain did not return a valid search.');
  let query = value.trim();
  // Trim surplus alternatives, preserving valid grouping and the intended required terms.
  while (operatorCount(query) > 5) {
    let changed = false;
    query = query.replace(/\(([^()]*)\)/g, (group, inner: string) => {
      if (changed) return group;
      const alternatives = inner.split(/\s+OR\s+/i);
      if (alternatives.length < 2) return group;
      changed = true;
      return `(${alternatives.slice(0, -1).join(' OR ')})`;
    });
    if (!changed) break;
  }
  return validateSearchQuery(query);
}

export function buyerPostQueries(queries: string[], profile: { sells: string; icp: string; pains: string[] }): string[] {
  const authority = new Set(['founder', 'co-founder', 'cofounder', 'ceo', 'hiring manager', 'head of people']);
  const profileText = [profile.sells, profile.icp, ...profile.pains].join(' ').toLowerCase();
  const hiringOffer = /hir(e|ing)|recruit|talent|candidate/i.test(profileText);
  const roles = hiringOffer ? ['sales', 'marketing', 'operations'].filter(role => new RegExp(`\\b${role}\\b`).test(profileText)).slice(0, 2) : [];
  return [...new Set(queries.map(original => {
    const removeGroup = (inside: string) => inside.split(/\s+OR\s+/i).every(term => authority.has(term.replace(/"/g, '').trim().toLowerCase()));
    let query = original.replace(/\s+AND\s+\(([^()]*)\)/gi, (whole, inside: string) => removeGroup(inside) ? '' : whole);
    query = query.replace(/^\(([^()]*)\)\s+AND\s+/i, (whole, inside: string) => removeGroup(inside) ? '' : whole);
    // Hiring searches match the role being filled; author authority is checked while scoring.
    if (roles.length && /hiring|hire|looking for/i.test(query) && !roles.some(role => new RegExp(`\\b${role}\\b`, 'i').test(query))) query += ` AND (${roles.join(' OR ')})`;
    return compactGeneratedQuery(query);
  }))];
}
