// "Mangent aussi": the household's extra eaters, each with age band and
// portion, and "Ajouter une personne". A row opens the sheet to edit it.
// In onboarding (04e) and household settings (24).
import { useState } from 'react';
import { useI18n } from '../i18n/index.tsx';
import { EATER_COLOR, type Eater, portionText, useEaters } from '../lib/eaters.ts';
import { EaterSheet } from './EaterSheet.tsx';
import { Icon } from './Icon.tsx';
import { Avatar, ListRow } from './ui.tsx';

export function useAgeBandLabel() {
  const { t } = useI18n();
  return (b: Eater['age_band']) => t(`eaters.bands.${b === '14+' ? 'adult' : b === '4-8' ? 'young' : 'older'}`);
}

export function EaterList() {
  const { t } = useI18n();
  const { data: eaters, reload } = useEaters();
  const bandLabel = useAgeBandLabel();
  const [editing, setEditing] = useState<Eater | null | 'new'>(null);
  return (
    <>
      <div className="list">
        {(eaters ?? []).map((e) => (
          <ListRow key={e.id} icon={<Avatar name={e.name} color={EATER_COLOR} />} title={e.name} meta={bandLabel(e.age_band)}
            value={<span className="portion-pill">{t('eaters.portionOf', { n: portionText(e.portion) })}</span>}
            chevron onClick={() => setEditing(e)} />
        ))}
        <ListRow accent chevron={false} icon={<span className="add-dot"><Icon name="plus" size={16} /></span>}
          title={t('eaters.add')} onClick={() => setEditing('new')} />
      </div>
      <EaterSheet open={editing !== null} eater={editing === 'new' ? null : editing}
        onClose={() => { setEditing(null); void reload(); }} />
    </>
  );
}
