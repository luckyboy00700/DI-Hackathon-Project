import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AgreementRecord } from '@/components/features/agreements/AgreementView';

/**
 * T062 — the downloadable half of the agreement. Rendered server-side from the SAME stored row
 * the HTML view reads, so the PDF cannot drift from what both parties agreed to (FR-016).
 */

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, lineHeight: 1.5, color: '#1a1a1a' },
  title: { fontSize: 18, marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#57534e', marginBottom: 16 },
  section: { marginBottom: 14 },
  heading: { fontSize: 13, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 160, color: '#57534e' },
  value: { flex: 1 },
  listItem: { marginBottom: 3 },
  footer: { marginTop: 20, fontSize: 9, color: '#57534e' },
});

export type AgreementPdfProps = {
  agreement: AgreementRecord;
  apprenticeName: string;
  businessName: string;
  tradeCategory: string;
};

export function AgreementDocument(props: AgreementPdfProps) {
  const { agreement } = props;
  const money = (value: number) => `$${Number(value).toFixed(2)}`;

  return (
    <Document title="Apprenticeship agreement">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Apprenticeship Agreement</Text>
        <Text style={styles.subtitle}>
          Amanah Apprenticeship Board · issued{' '}
          {new Date(agreement.generated_at).toLocaleDateString()}
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>Parties and placement</Text>
          <Field label="Apprentice" value={props.apprenticeName} />
          <Field label="Mentor / business" value={props.businessName} />
          <Field label="Trade" value={props.tradeCategory.replace(/_/g, ' ')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Terms</Text>
          <Field label="Length" value={`${agreement.duration_weeks} weeks`} />
          <Field label="Hours per week" value={`${agreement.weekly_hours}`} />
          <Field label="Hourly rate" value={money(agreement.hourly_rate)} />
          <Field label="Estimated total hours" value={`${agreement.total_estimated_hours}`} />
          <Field label="Estimated gross pay" value={money(agreement.estimated_gross_pay)} />
        </View>

        <ListSection title="Mentorship milestones" items={agreement.mentorship_milestones} />
        <ListSection title="Safety and equipment" items={agreement.safety_obligations} />

        <View style={styles.section}>
          <Text style={styles.heading}>Ending this placement</Text>
          <Text>{agreement.termination_terms}</Text>
        </View>

        <Text style={styles.footer}>
          Wages are paid directly by the business. This platform records the agreed terms and does
          not process payment. Both parties hold an identical copy of this record.
        </Text>
      </Page>
    </Document>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      {items.map((item) => (
        <Text key={item} style={styles.listItem}>
          • {item}
        </Text>
      ))}
    </View>
  );
}
