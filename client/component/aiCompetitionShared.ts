export function sharedSelections(teams: any[], listScope: string) {
  const stocks = new Map<string, any>();
  teams.forEach(team => team.candidates.forEach((candidate: any) => {
    if (listScope === 'active' && !candidate.visible || listScope === 'archive' && candidate.visible) return;
    let stock = stocks.get(candidate.symbol);
    if (!stock) { stock = { symbol: candidate.symbol, name: candidate.name, industry: candidate.industry, members: [], dates: new Map<string, Set<string>>() }; stocks.set(candidate.symbol, stock); }
    let member = stock.members.find((m: any) => m.id === team.id);
    if (!member) { member = { id: team.id, label: team.label, candidates: [] }; stock.members.push(member); }
    member.candidates.push(candidate);
    if (!stock.dates.has(candidate.decisionDate)) stock.dates.set(candidate.decisionDate, new Set<string>());
    stock.dates.get(candidate.decisionDate).add(team.id);
  }));
  return [...stocks.values()].map(stock => {
    stock.members.forEach((member: any) => { member.candidates.sort((a: any, b: any) => b.decisionDate.localeCompare(a.decisionDate) || a.id.localeCompare(b.id)); member.latest = member.candidates[0]; });
    const sharedDates = [...stock.dates.entries()].filter(([, ids]: any) => ids.size > 1).map(([date, ids]: any) => ({ date, teams: [...ids] })).sort((a, b) => b.date.localeCompare(a.date));
    return { symbol: stock.symbol, name: stock.name, industry: stock.industry, members: stock.members, teamCount: stock.members.length, sharedDates };
  }).sort((a, b) => b.teamCount - a.teamCount || a.symbol.localeCompare(b.symbol));
}
