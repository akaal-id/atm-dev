import {
  createBrand,
  failure,
  getProjectHubData,
  listCompanyBrands,
  readJsonBody,
  requireProjectAccess,
  setProjectBrands,
} from "@/lib/server/project-hub";

/** Create a company brand (or sub-brand) and link it to this project. */
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const body = await readJsonBody(request);
  const name = String(body.name ?? "").trim();
  const parentId = String(body.parent_brand_id ?? "").trim() || null;
  if (!name) return Response.json({ error: "Brand name is required." }, { status: 400 });

  const { companyId } = guard.access;
  try {
    const companyBrands = await listCompanyBrands(companyId);
    if (parentId && !companyBrands.some((brand) => brand.brand_id === parentId)) {
      return Response.json({ error: "Parent brand not found." }, { status: 400 });
    }
    const duplicate = companyBrands.find(
      (brand) => brand.name.toLowerCase() === name.toLowerCase() && (brand.parent_brand_id ?? null) === parentId,
    );
    const brand = duplicate ?? (await createBrand(companyId, { name, parent_brand_id: parentId }));

    const linked = (await getProjectHubData(projectId, companyId)).brands.map((item) => item.brand_id);
    await setProjectBrands(projectId, companyId, [...linked, brand.brand_id]);
    return Response.json({ data: brand }, { status: duplicate ? 200 : 201 });
  } catch (error) {
    return failure(error, "Failed to add brand.");
  }
}

/** Replace the project's brand selection with `brand_ids` (company brands only). */
export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  const guard = await requireProjectAccess(projectId, "edit");
  if (guard.error) return guard.error;

  const body = await readJsonBody(request);
  if (!Array.isArray(body.brand_ids)) {
    return Response.json({ error: "brand_ids must be an array." }, { status: 400 });
  }

  try {
    const ids = await setProjectBrands(projectId, guard.access.companyId, body.brand_ids.map(String));
    return Response.json({ data: ids });
  } catch (error) {
    return failure(error, "Failed to update project brands.");
  }
}
