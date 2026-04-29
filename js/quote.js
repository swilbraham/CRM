// Printable quote / invoice — uses the job's company for branding.

const Quote = (() => {
  function open(jobId) {
    const job = Store.getJob(jobId);
    if (!job) return;
    const customer = Store.getCustomer(job.customerId);
    const company = Store.getCompany(job.companyId) || Store.getCompanies()[0];

    if (!company) {
      UI.toast('No company set up — visit Companies first');
      return;
    }

    const isInvoice = job.status === 'invoiced';
    const docNumber = isInvoice ? (job.invoiceNo || '—') : (job.quoteNo || '—');
    const docTitle = isInvoice ? 'Invoice' : 'Quote';
    const dateLabel = isInvoice ? 'Invoice date' : 'Quote date';
    const total = UI.jobTotal(job);
    const accent = company.color || '#2563eb';

    const customerLines = customer ? [
      `<strong>${UI.escapeHtml(customer.name)}</strong>`,
      UI.escapeHtml(customer.address || ''),
      UI.escapeHtml([customer.city, customer.postcode].filter(Boolean).join(', ')),
      customer.phone ? UI.escapeHtml(customer.phone) : '',
      customer.email ? UI.escapeHtml(customer.email) : '',
    ].filter(Boolean).join('<br/>') : 'Unknown customer';

    const businessLines = [
      `<strong>${UI.escapeHtml(company.name)}</strong>`,
      UI.escapeHtml(company.address || '').replace(/\n/g, '<br/>'),
      company.phone ? UI.escapeHtml(company.phone) : '',
      company.email ? UI.escapeHtml(company.email) : '',
      company.vatNumber ? `VAT: ${UI.escapeHtml(company.vatNumber)}` : '',
    ].filter(Boolean).join('<br/>');

    const logoBlock = company.logo
      ? `<img src="${UI.escapeHtml(company.logo)}" alt="${UI.escapeHtml(company.name)} logo" class="quote-logo" />`
      : `<div class="quote-logo-placeholder" style="background:${accent}1a;color:${accent};">${UI.escapeHtml((company.shortName || company.name).slice(0, 2).toUpperCase())}</div>`;

    UI.openModal(`
      <div class="modal-header no-print">
        <h2>${docTitle} preview · ${UI.escapeHtml(company.shortName || company.name)}</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="quote-doc" id="quote-doc" style="--quote-accent:${accent};">
          <div class="quote-head">
            <div class="quote-head-left">
              ${logoBlock}
              <div>
                <h1>${docTitle}</h1>
                <div class="text-muted" style="font-size: 13px;">#${UI.escapeHtml(String(docNumber))}</div>
              </div>
            </div>
            <div class="quote-meta">
              ${businessLines}
            </div>
          </div>

          <div class="quote-parties">
            <div class="quote-party">
              <h3>Bill to</h3>
              <p>${customerLines}</p>
            </div>
            <div class="quote-party">
              <h3>${dateLabel}</h3>
              <p><strong>${UI.formatDate(job.date || new Date().toISOString().slice(0, 10))}</strong></p>
            </div>
          </div>

          <table class="quote-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="width: 80px; text-align: center;">Qty</th>
                <th style="width: 110px; text-align: right;">Unit price</th>
                <th style="width: 110px; text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${job.items.map(it => {
                const amt = (Number(it.qty) || 1) * (Number(it.price) || 0);
                return `
                  <tr>
                    <td>${UI.escapeHtml(it.description)}</td>
                    <td style="text-align: center;">${it.qty || 1}</td>
                    <td style="text-align: right;">${UI.formatMoney(it.price)}</td>
                    <td style="text-align: right;">${UI.formatMoney(amt)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="text-align: right;">Total</td>
                <td style="text-align: right;">${UI.formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>

          ${job.notes ? `
            <div class="quote-notes">
              <strong>Notes:</strong><br/>
              ${UI.escapeHtml(job.notes).replace(/\n/g, '<br/>')}
            </div>
          ` : ''}

          <div class="quote-foot">
            ${isInvoice
              ? 'Payment due on receipt unless agreed otherwise. Thank you for your business.'
              : 'Quote valid for 30 days. To accept, please reply to confirm.'}
          </div>
        </div>
      </div>
      <div class="modal-footer no-print">
        <button type="button" class="btn btn-secondary" data-close>Close</button>
        <button type="button" class="btn btn-secondary" id="edit-company-btn">Edit company details</button>
        <button type="button" class="btn" id="print-btn">${UI.icon('print')} Print / save PDF</button>
      </div>
    `, { wide: true });

    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.getElementById('edit-company-btn').addEventListener('click', () => {
      UI.closeModal();
      Companies.openEdit(company.id);
    });
  }

  return { open };
})();
