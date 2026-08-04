import { API } from "@/utils/API";

export interface CustomPlanEnquiryRequest {
  name: string;
  mobile: string;
  email: string;
  /** Optional free-text brief from the visitor. */
  message?: string;
}

export interface CustomPlanEnquirySuccessResponse {
  success: true;
  message: string;
}

export const customPlanEnquiryService = {
  // Public: submits a custom/enterprise plan enquiry from the landing page
  // (no auth) — backend emails it to the sales team.
  submit: async (payload: CustomPlanEnquiryRequest): Promise<CustomPlanEnquirySuccessResponse> => {
    const { data } = await API.post("/public/custom-plan-enquiry", payload);
    return data;
  },
};
