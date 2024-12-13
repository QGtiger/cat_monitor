import axios from "axios";

const client = axios.create({
  baseURL: "https://api.yingdao.com",
});

export function uploadFile(file: File) {
  return new Promise<string>(async (r) => {
    const response = await client<
      any,
      {
        success: boolean;
        data: any;
      }
    >("/api/tool/ipaas/fileStorage/uploadUrl", {
      method: "POST",
      data: {
        bizId: "704957102717186048",
        fileSize: file.size,
        fileName: file.name,
      },
      headers: {
        "Content-Type": "application/json",
        "Xybot-Product": "rpa",
      },
    });
    if (response.success) {
      const {
        data: { uploadUrl, readUrl },
      } = response;
      const res = await fetch(uploadUrl, {
        method: "put",
        body: file,
        headers: {
          "Content-Disposition": `attachment;filename=${encodeURIComponent(
            file.name
          )}`,
        },
      });
      if (res.status === 200) {
        r(readUrl);
      }
    }
    r("");
  });
}
