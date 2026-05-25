import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

const imagensDentes: Record<string, string> = {
  "51": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-51-558f132b-4e33-41ba-92b8-3304a45b7ffa.png",
  "52": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-52-27044cef-b781-4f94-aa61-3fee6455c0f8.png",
  "53": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-53-e5672934-77fe-445c-b8ea-fdf620392958.png",
  "54": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-54-6f2704f7-0023-4dfa-add1-af8f9a51f1ed.png",
  "55": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-55-5d32b38f-0198-4650-ab23-5934ce95f8f9.png",
  "61": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-61-f1a1e3ce-ae05-4c21-8a5f-d622f5de5b03.png",
  "62": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-62-08e7d572-a974-471e-a03e-88e9c0ddcb1c.png",
  "63": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-63-0e526ccc-1eb7-4a42-ad3f-38471a41df6c.png",
  "64": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-64-f727260e-f1ec-46e3-91b7-3cb7242fe5cc.png",
  "65": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente_65-b775ced4-f32a-485b-ae28-83f942ba3f6b.png",
  "71": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-71-e1fbff49-1e9a-492d-84c3-bc8365e0ea82.png",
  "72": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente_72-cf634b03-1990-42a3-b05b-2ce80e06f12e.png",
  "73": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-73-de04b2ce-87ac-40c1-ab33-b8cc7fc12f10.png",
  "74": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-74-2576741a-0704-4d87-897f-b172f374f357.png",
  "75": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-75-ecc49c07-1a87-400e-b445-e800fc65a51f.png",
  "81": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-81-b97a5242-7202-42a4-a2d2-eb390e3052fc.png",
  "82": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-82-e0c336b0-5106-40c1-8bc4-1a1c53cfbfad.png",
  "83": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-83-eaf207f8-7608-4b6a-8f86-877139566736.png",
  "84": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-84-f59e6c10-58df-45ce-9736-5b5f230b38fe.png",
  "85": "C:\\Users\\meuco\\.cursor\\projects\\c-Users-meuco-cursor-projects-empty-window-lab-protese-saas\\assets\\c__Users_meuco_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_dente-85-7123fff3-7ace-4562-beeb-34827e406b96.png",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ numero: string }> }
) {
  const { numero } = await params;
  const imagePath = imagensDentes[numero];

  if (!imagePath) {
    return NextResponse.json({ error: "Imagem não encontrada" }, { status: 404 });
  }

  const file = await readFile(imagePath);
  return new Response(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
