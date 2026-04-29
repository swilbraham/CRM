// Printable quote / invoice view, generated from a job.

const Quote = (() => {
  function open(jobId) {
    const job = Store.getJob(jobId);
    if (!job) return;
    const customer = Store.getCustomer(job.customerId);
    const settings = Store.getSettings();

    const isInvoice = job.status === 'invoiced';
    const docNumber = isInvoice
      ? (job.invoiceNo || '—')
      : (job.quoteNo || '—');
    const docTitle = isInvoice ? 'Invoice' : 'Quote';
    const dateLabel = isInvoice ? 'Invoice date' : 'Quote date';
    const total = UI.jobTotal(job);

    const customerLines = customer ? [
      `<strong>${UI.escapeHtml(customer.name)}</strong>`,
      UI.escapeHtml(customer.address || ''),
      UI.escapeHtml([customer.city, customer.postcode].filter(Boolean).join(', ')),
      customer.phone ? UI.escapeHtml(customer.phone) : '',
      customer.email ? UI.escapeHtml(customer.email) : '',
    ].filter(Boolean).join('<br/>') : 'Unknown customer';

    const businessLines = [
      `<strong>${UI.escapeHtml(settings.businessName)}</strong>`,
      UI.escapeHtml(settings.businessAddress || ''),
      settings.businessPhone ? UI.escapeHtml(settings.businessPhone) : '',
      settings.businessEmail ? UI.escapeHtml(settings.businessEmail) : '',
      settings.vatNumber ? `VAT: ${UI.escapeHtml(settings.vatNumber)}` : '',
    ].filter(Boolean).join('<br/>');

    UI.openModal(`
      <div class="modal-header no-print">
        <h2>${docTitle} preview</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="quote-doc" id="quote-doc">
          <div class="quote-head">
            <div>
              <h1>${docTitle}</h1>
              <div class="text-muted" style="font-size: 13px;">#${UI.escapeHtml(String(docNumber))}</div>
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
              ${job.time ? `<p>Service time: ${UI.escapeHtml(job.time)}</p>` : ''}
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
        <button type="button" class="btn btn-secondary" id="settings-btn">Business details</button>
        <button type="button" class="btn" id="print-btn">${UI.icon('print')} Print / save PDF</button>
      </div>
    `, { wide: true });

    document.getElementById('print-btn').addEventListener('click', () => window.print());
    document.getElementById('settings-btn').addEventListener('click', openSettings);
  }

  function openSettings() {
    const s = Store.getSettings();
    UI.openModal(`
      <div class="modal-header">
        <h2>Business details</h2>
        <button class="modal-close" data-close>${UI.icon('close')}</button>
      </div>
      <form id="settings-form">
        <div class="modal-body">
          <p class="text-muted mb-3" style="font-size: 13px;">These appear on quotes and invoices.</p>
          <div class="field">
            <label class="label">Business name</label>
            <input class="input" name="businessName" value="${UI.escapeHtml(s.businessName)}" />
          </div>
          <div class="field-row">
            <div class="field">
              <label class="label">Phone</label>
              <input class="input" name="businessPhone" value="${UI.escapeHtml(s.businessPhone)}" />
            </div>
            <div class="field">
              <label class="label">Email</label>
              <input class="input" type="email" name="businessEmail" value="${UI.escapeHtml(s.businessEmail)}" />
            </div>
          </div>
          <div class="field">
            <label class="label">Address</label>
            <textarea class="textarea" name="businessAddress">${UI.escapeHtml(s.businessAddress)}</textarea>
          </div>
          <div class="field">
            <label class="label">VAT number (optional)</label>
            <input class="input" name="vatNumber" value="${UI.escapeHtml(s.vatNumber)}" />
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-close>Cancel</button>
          <button type="submit" class="btn">Save</button>
        </div>
      </form>
    `);

    document.getElementById('settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const current = Store.getSettings();
      Store.saveSettings({
        ...current,
        businessName: fd.get('businessName').trim() || 'Carpet & Upholstery Cleaning',
        businessPhone: fd.get('businessPhone').trim(),
        businessEmail: fd.get('businessEmail').trim(),
        businessAddress: fd.get('businessAddress').trim(),
        vatNumber: fd.get('vatNumber').trim(),
      });
      UI.closeModal();
      UI.toast('Business details saved');
    });
  }

  return { open, openSettings };
})();
