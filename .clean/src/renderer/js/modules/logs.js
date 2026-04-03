// Activity Logs Module
export async function render() {
  const logs = await api.logs.getAll();
  document.getElementById('page-content').innerHTML = `
    <div class="page-header"><h2>Activity Log</h2><span class="badge badge-gray">${logs.length} entries</span></div>
    <div class="card">
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>#</th><th>Date & Time</th><th>Action</th><th>Description</th></tr></thead>
          <tbody>${logs.map((l,i)=>`
            <tr>
              <td>${i+1}</td>
              <td>${new Date(l.created_at).toLocaleString('en-IN')}</td>
              <td><span class="badge ${l.action.includes('SALE')?'badge-success':l.action.includes('PURCHASE')?'badge-info':'badge-gray'}">${l.action}</span></td>
              <td>${l.description||'-'}</td>
            </tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted" style="padding:30px">No activity logged yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;
}
