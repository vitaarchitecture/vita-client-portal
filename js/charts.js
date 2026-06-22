function renderGanttChart(containerId, invoiceData) {
  const stages = invoiceData.filter(i => i.stage_start && i.stage_end);
  if (stages.length === 0) return;

  const merged = [];
  stages.forEach(s => {
    const existing = merged.find(m => m.stage_start === s.stage_start && m.stage_end === s.stage_end);
    if (existing) {
      existing.amount += parseFloat(s.amount || 0);
      existing.percent_complete = Math.max(existing.percent_complete, parseInt(s.percent_complete || 0));
    } else {
      merged.push({
        label: s.description.replace(/ \(\d+%\)$/, ''),
        stage_start: s.stage_start,
        stage_end: s.stage_end,
        amount: parseFloat(s.amount || 0),
        percent_complete: parseInt(s.percent_complete || 0),
        status: s.status
      });
    }
  });

  const allDates = merged.flatMap(s => [parseDate(s.stage_start), parseDate(s.stage_end)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

  const rowHeight = 44;
  const topPadding = 40;
  const leftPadding = 220;
  const rightPadding = 60;
  const chartWidth = 740;
  const barAreaWidth = chartWidth - leftPadding - rightPadding;
  const svgHeight = topPadding + merged.length * rowHeight + 20;

  const months = [];
  const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    months.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = leftPadding + ((today - minDate) / (1000 * 60 * 60 * 24)) / totalDays * barAreaWidth;

  let svg = `<svg viewBox="0 0 ${chartWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;font-family:Inter,sans-serif;">`;

  months.forEach(m => {
    const x = leftPadding + ((m - minDate) / (1000 * 60 * 60 * 24)) / totalDays * barAreaWidth;
    svg += `<line x1="${x}" y1="${topPadding - 5}" x2="${x}" y2="${svgHeight - 10}" stroke="#e0e0e0" stroke-width="1"/>`;
    svg += `<text x="${x + 4}" y="${topPadding - 12}" font-size="10" fill="#6b6b6b">${m.toLocaleDateString('en-GB', {month: 'short', year: '2-digit'})}</text>`;
  });

  if (todayX >= leftPadding && todayX <= leftPadding + barAreaWidth) {
    svg += `<line x1="${todayX}" y1="${topPadding - 5}" x2="${todayX}" y2="${svgHeight - 10}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    svg += `<text x="${todayX}" y="${topPadding - 12}" font-size="9" fill="#e74c3c" text-anchor="middle" font-weight="600">TODAY</text>`;
  }

  merged.forEach((s, i) => {
    const y = topPadding + i * rowHeight;
    const start = parseDate(s.stage_start);
    const end = parseDate(s.stage_end);
    const x = leftPadding + ((start - minDate) / (1000 * 60 * 60 * 24)) / totalDays * barAreaWidth;
    const w = ((end - start) / (1000 * 60 * 60 * 24)) / totalDays * barAreaWidth;
    const pct = s.percent_complete;

    svg += `<text x="${leftPadding - 10}" y="${y + 20}" font-size="11" fill="#1a1a1a" text-anchor="end" font-weight="500">${s.label}</text>`;
    svg += `<rect x="${x}" y="${y + 8}" width="${w}" height="22" rx="4" fill="#e8e8e8"/>`;
    if (pct > 0) {
      const color = pct === 100 ? '#27ae60' : '#3498db';
      svg += `<rect x="${x}" y="${y + 8}" width="${w * pct / 100}" height="22" rx="4" fill="${color}"/>`;
    }
    svg += `<text x="${x + w + 6}" y="${y + 23}" font-size="10" fill="#6b6b6b">${pct}%</text>`;
  });

  svg += '</svg>';
  document.getElementById(containerId).innerHTML = svg;
}

function renderDrawdownChart(containerId, invoiceData) {
  const stages = invoiceData.filter(i => i.stage_start && i.stage_end);
  if (stages.length === 0) return;

  const totalFee = stages.reduce((s, i) => s + parseFloat(i.amount || 0), 0);
  if (totalFee === 0) return;

  const allDates = stages.flatMap(s => [parseDate(s.stage_start), parseDate(s.stage_end)]);
  const minDate = new Date(Math.min(...allDates));
  const maxDate = new Date(Math.max(...allDates));
  const totalDays = (maxDate - minDate) / (1000 * 60 * 60 * 24);

  const chartWidth = 700;
  const chartHeight = 250;
  const topPadding = 30;
  const bottomPadding = 40;
  const leftPadding = 60;
  const rightPadding = 120;
  const plotW = chartWidth - leftPadding - rightPadding;
  const plotH = chartHeight - topPadding - bottomPadding;

  const merged = [];
  stages.forEach(s => {
    const existing = merged.find(m => m.stage_start === s.stage_start && m.stage_end === s.stage_end);
    if (existing) {
      existing.amount += parseFloat(s.amount || 0);
      existing.percent_complete = Math.max(existing.percent_complete, parseInt(s.percent_complete || 0));
    } else {
      merged.push({
        label: s.description.replace(/ \(\d+%\)$/, ''),
        stage_start: s.stage_start,
        stage_end: s.stage_end,
        amount: parseFloat(s.amount || 0),
        percent_complete: parseInt(s.percent_complete || 0)
      });
    }
  });
  merged.sort((a, b) => parseDate(a.stage_start) - parseDate(b.stage_start));

  // Planned drawdown: cumulative fee at end of each stage
  const plannedPoints = [{x: 0, y: 0}];
  let cumFee = 0;
  merged.forEach(s => {
    const endDay = (parseDate(s.stage_end) - minDate) / (1000 * 60 * 60 * 24);
    cumFee += s.amount;
    plannedPoints.push({x: endDay / totalDays, y: cumFee / totalFee});
  });

  // Actual drawdown: based on percent_complete
  const actualPoints = [{x: 0, y: 0}];
  let cumActual = 0;
  merged.forEach(s => {
    const endDay = (parseDate(s.stage_end) - minDate) / (1000 * 60 * 60 * 24);
    cumActual += s.amount * (s.percent_complete / 100);
    actualPoints.push({x: endDay / totalDays, y: cumActual / totalFee});
  });

  // Invoiced drawdown: paid + overdue = invoiced
  const invoicedPoints = [{x: 0, y: 0}];
  let cumInvoiced = 0;
  const invoicedStages = invoiceData.filter(i => i.status === 'paid' || i.status === 'overdue');
  invoicedStages.forEach(s => {
    const issueDay = parseDate(s.date_issued);
    if (!issueDay) return;
    const dayFrac = (issueDay - minDate) / (1000 * 60 * 60 * 24) / totalDays;
    cumInvoiced += parseFloat(s.amount || 0);
    invoicedPoints.push({x: dayFrac, y: cumInvoiced / totalFee});
  });
  // extend invoiced line to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayFrac = Math.min(1, (today - minDate) / (1000 * 60 * 60 * 24) / totalDays);
  invoicedPoints.push({x: todayFrac, y: cumInvoiced / totalFee});

  function toSVGPath(points) {
    return points.map((p, i) => {
      const x = leftPadding + p.x * plotW;
      const y = topPadding + plotH - p.y * plotH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  const months = [];
  const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  while (d <= maxDate) {
    months.push(new Date(d));
    d.setMonth(d.getMonth() + 1);
  }

  const todayX = leftPadding + todayFrac * plotW;

  let svg = `<svg viewBox="0 0 ${chartWidth} ${chartHeight}" xmlns="http://www.w3.org/2000/svg" style="width:100%;font-family:Inter,sans-serif;">`;

  // Grid
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = topPadding + plotH - (pct / 100) * plotH;
    svg += `<line x1="${leftPadding}" y1="${y}" x2="${leftPadding + plotW}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
    svg += `<text x="${leftPadding - 8}" y="${y + 4}" font-size="10" fill="#6b6b6b" text-anchor="end">${pct}%</text>`;
  }

  months.forEach(m => {
    const frac = (m - minDate) / (1000 * 60 * 60 * 24) / totalDays;
    const x = leftPadding + frac * plotW;
    svg += `<line x1="${x}" y1="${topPadding}" x2="${x}" y2="${topPadding + plotH + 5}" stroke="#e8e8e8" stroke-width="1"/>`;
    svg += `<text x="${x}" y="${topPadding + plotH + 20}" font-size="10" fill="#6b6b6b" text-anchor="middle">${m.toLocaleDateString('en-GB', {month: 'short'})}</text>`;
  });

  // Today line
  if (todayX >= leftPadding && todayX <= leftPadding + plotW) {
    svg += `<line x1="${todayX}" y1="${topPadding}" x2="${todayX}" y2="${topPadding + plotH}" stroke="#e74c3c" stroke-width="1.5" stroke-dasharray="4,3"/>`;
  }

  // Planned line (grey)
  svg += `<path d="${toSVGPath(plannedPoints)}" fill="none" stroke="#bbb" stroke-width="2" stroke-dasharray="6,3"/>`;

  // Actual progress line (blue)
  svg += `<path d="${toSVGPath(actualPoints)}" fill="none" stroke="#3498db" stroke-width="2.5"/>`;

  // Invoiced line (red)
  svg += `<path d="${toSVGPath(invoicedPoints)}" fill="none" stroke="#e74c3c" stroke-width="2.5"/>`;

  // Dots at current actual progress
  const lastActual = actualPoints[actualPoints.length - 1];
  const ax = leftPadding + lastActual.x * plotW;
  const ay = topPadding + plotH - lastActual.y * plotH;
  svg += `<circle cx="${ax}" cy="${ay}" r="4" fill="#3498db"/>`;
  svg += `<text x="${ax + 8}" y="${ay + 4}" font-size="10" fill="#3498db" font-weight="600">${Math.round(lastActual.y * 100)}% complete</text>`;

  // Dot at invoiced
  const lastInv = invoicedPoints[invoicedPoints.length - 1];
  const ix = leftPadding + lastInv.x * plotW;
  const iy = topPadding + plotH - lastInv.y * plotH;
  svg += `<circle cx="${ix}" cy="${iy}" r="4" fill="#e74c3c"/>`;
  svg += `<text x="${ix + 8}" y="${iy + 4}" font-size="10" fill="#e74c3c" font-weight="600">£${Math.round(lastInv.y * totalFee).toLocaleString()} invoiced</text>`;

  // Legend
  const ly = chartHeight - 8;
  svg += `<line x1="${leftPadding}" y1="${ly}" x2="${leftPadding + 20}" y2="${ly}" stroke="#bbb" stroke-width="2" stroke-dasharray="6,3"/>`;
  svg += `<text x="${leftPadding + 25}" y="${ly + 3}" font-size="9" fill="#6b6b6b">Planned</text>`;
  svg += `<line x1="${leftPadding + 80}" y1="${ly}" x2="${leftPadding + 100}" y2="${ly}" stroke="#3498db" stroke-width="2.5"/>`;
  svg += `<text x="${leftPadding + 105}" y="${ly + 3}" font-size="9" fill="#6b6b6b">Actual Progress</text>`;
  svg += `<line x1="${leftPadding + 195}" y1="${ly}" x2="${leftPadding + 215}" y2="${ly}" stroke="#e74c3c" stroke-width="2.5"/>`;
  svg += `<text x="${leftPadding + 220}" y="${ly + 3}" font-size="9" fill="#6b6b6b">Invoiced</text>`;

  svg += '</svg>';
  document.getElementById(containerId).innerHTML = svg;
}
