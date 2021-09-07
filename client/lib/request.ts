export async function request(path: string, options: any = {}): Promise<any> {
  const headers = Object.assign({}, options.headers || {}, {
    'Content-Type': 'application/json; charset=UTF-8'
  })

  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  return data
}

export async function get(path: string, options: any = {}): Promise<any> {
  return request(path, {...options, method: 'GET'})
}

export async function post(path: string, options: any = {}): Promise<any> {
  return request(path, {...options, method: 'POST'})
}

export async function put(path: string, options: any = {}): Promise<any> {
  return request(path, {...options, method: 'PUT'})
}

export async function del(path: string, options: any = {}): Promise<any> {
  return request(path, {...options, method: 'DELETE'})
}
