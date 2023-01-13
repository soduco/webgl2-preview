# webgl2-preview

Steps to dockerize the app (from [svelte society](https://sveltesociety.dev/recipes/publishing-and-deploying/dockerize-a-svelte-app), twiked to work with pnpm and "build" as source folder):

- Build the image:

```bash
docker build . -t svelte-docker
```

Or

- Build the image behind proxy

```bash
docker build . -t svelte-docker --build-arg http_proxy=http://your.proxy:3128 --build-arg https_proxy=http://your.proxy:3128
```


- Run the container

```bash
docker run --rm --name=svelte-docker -p 5000:80 svelte-docker
```

And that's all folks ! You can access the app in your web browser at [localhost:5000](http://localhost:5000)