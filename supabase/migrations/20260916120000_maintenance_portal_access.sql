-- Client portal read access to their own landscape maintenance records.
-- Mirrors the existing portal_client_* policies for projects/site_reports:
-- scoped through public.my_portal_client_id(), SELECT only, no writes.
-- Digital approval of extra-work requests from the portal stays deferred —
-- approval_requests.approver_id is modelled as a staff employee today.

CREATE POLICY "portal_client_maintenance_sites_select" ON public.maintenance_sites
  FOR SELECT TO authenticated USING (client_id = public.my_portal_client_id());

CREATE POLICY "portal_client_maintenance_contracts_select" ON public.maintenance_contracts
  FOR SELECT TO authenticated USING (client_id = public.my_portal_client_id());

CREATE POLICY "portal_client_maintenance_tasks_select" ON public.maintenance_tasks
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.maintenance_sites s WHERE s.id = maintenance_tasks.site_id
      AND s.client_id = public.my_portal_client_id()));

CREATE POLICY "portal_client_maintenance_task_logs_select" ON public.maintenance_task_logs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t
      JOIN public.maintenance_sites s ON s.id = t.site_id
      WHERE t.id = maintenance_task_logs.task_id AND s.client_id = public.my_portal_client_id()));

CREATE POLICY "portal_client_maintenance_inspections_select" ON public.maintenance_inspections
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.maintenance_sites s WHERE s.id = maintenance_inspections.site_id
      AND s.client_id = public.my_portal_client_id()));

CREATE POLICY "portal_client_inspection_findings_select" ON public.inspection_findings
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.maintenance_inspections i
      JOIN public.maintenance_sites s ON s.id = i.site_id
      WHERE i.id = inspection_findings.inspection_id AND s.client_id = public.my_portal_client_id()));

CREATE POLICY "portal_client_maintenance_issues_select" ON public.maintenance_issues
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.maintenance_sites s WHERE s.id = maintenance_issues.site_id
      AND s.client_id = public.my_portal_client_id()));
