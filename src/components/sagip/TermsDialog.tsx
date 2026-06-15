import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { type ReactNode } from "react";

export function TermsDialog({ trigger }: { trigger: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>SAGIP Terms and Conditions</DialogTitle>
          <DialogDescription>
            Last updated: June 2026 — Please read carefully before creating an account.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <section>
              <h3 className="font-semibold text-foreground">1. Acceptance of Terms</h3>
              <p>By creating an account on SAGIP (Sistema ng Agarang Ginhawa sa Inaasahang Panganib), you agree to be bound by these Terms and Conditions, our Privacy Notice, and all applicable Philippine laws including Republic Act No. 10173 (Data Privacy Act of 2012) and Republic Act No. 10121 (Philippine Disaster Risk Reduction and Management Act of 2010).</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">2. Eligibility</h3>
              <p>You must be at least 18 years of age and a resident or citizen of the Philippines able to present a valid government-issued identification document. Submission of false or fraudulent identification is a criminal offense punishable under the Revised Penal Code.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">3. Account Responsibilities</h3>
              <p>You are responsible for safeguarding your password and for any activity conducted through your account. Notify the SAGIP DRRM Office immediately of any unauthorized use. SAGIP is not liable for losses arising from your failure to protect your credentials.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">4. Donations and Assistance Requests</h3>
              <p>All monetary donations made through SAGIP are final and non-refundable except where required by law. Assistance requests must be truthful and accurate; fraudulent claims will be reported to the appropriate authorities and may result in criminal prosecution. All transactions are recorded in an immutable audit log accessible to authorized DRRM officers and government auditors.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">5. Acceptable Use</h3>
              <p>You agree not to: (a) impersonate any person or entity; (b) interfere with or disrupt the platform; (c) attempt to gain unauthorized access to any account or system; (d) use SAGIP for any purpose unrelated to disaster relief, donations, or community assistance; (e) upload malicious code or content that violates Philippine law.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">6. Data Privacy</h3>
              <p>Your personal data and uploaded identification documents are collected, processed, and stored solely for identity verification, disaster response coordination, donor acknowledgment, and audit purposes. You retain your rights under RA 10173 to access, correct, object to processing, and request deletion of your personal information, subject to legal retention requirements.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">7. Suspension and Termination</h3>
              <p>SAGIP reserves the right to suspend or terminate accounts that violate these Terms, applicable law, or the directives of the City DRRM Office. You may close your account at any time, subject to retention of records required by law and for audit integrity.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">8. Limitation of Liability</h3>
              <p>SAGIP and its operators provide the platform on an "as is" basis. To the maximum extent permitted by law, we disclaim liability for indirect, incidental, or consequential damages arising from use of the platform, except where caused by gross negligence or willful misconduct.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">9. Amendments</h3>
              <p>These Terms may be updated from time to time. Material changes will be communicated through the platform. Continued use of SAGIP after such changes constitutes your acceptance of the revised Terms.</p>
            </section>
            <section>
              <h3 className="font-semibold text-foreground">10. Governing Law</h3>
              <p>These Terms are governed by the laws of the Republic of the Philippines. Any dispute shall be submitted to the exclusive jurisdiction of the proper courts of the City where the SAGIP DRRM Office is seated.</p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
